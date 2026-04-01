import "server-only";
import { getAccessToken, KIS_BASE_URL, formatYYYYMMDD } from "./kis";

// --- [Interfaces] ---

export interface MarketFundsData {
  date: string;
  deposit: number;      // 고객예탁금
  margin_loan: number;  // 신용융자 잔고
  misu: number;         // 위탁매매 미수금
}

export interface CreditBalanceData {
  date: string;
  amount: number;       // 신용잔고 금액
  ratio: number;        // 신용비중 (전체 대비)
}

export interface InvestorFlowData {
  rank: number;
  code: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  amount: number;       // 순매수 금액 (백만 단위일 수 있음)
}

export interface IndexPriceData {
  label: string;
  value: string;
  change: string;
  changePercent: string;
  direction: "up" | "down" | "flat";
  advanceCount?: number; // 상승 종목 수
  declineCount?: number; // 하락 종목 수
}

// --- [Functions] ---

/**
 * 국내 주요 지수를 가져옵니다. (코스피, 코스닥, 코스피200)
 * TR_ID: FHPST01710000 (국내지수 현재가)
 */
export async function fetchMajorIndex(code: string, label: string): Promise<IndexPriceData | null> {
  const token = await getAccessToken();
  const appKey = process.env.KIS_APP_KEY!;
  const appSecret = process.env.KIS_APP_SECRET!;

  const url = `${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-index-price?FID_COND_MRKT_DIV_CODE=U&FID_INPUT_ISCD=${code}`;

  const headers = {
    "Content-Type": "application/json",
    authorization: `Bearer ${token}`,
    appkey: appKey,
    appsecret: appSecret,
    tr_id: "FHPST01710000",
    custtype: "P",
  };

  try {
    const res = await fetch(url, { headers, cache: "no-store" });
    if (!res.ok) return null;

    const data = await res.json();

    // 만약 현재가 데이터가 없거나 에러면 (장 종료 등), 일별 시세에서 최신값 가져오기 시도
    if (data.rt_cd !== "0" || !data.output) {
      console.warn(`fetchMajorIndex(${label}) KIS 에러: [${data.rt_cd}] ${data.msg1}. 일별 시세로 전환합니다.`);
      return fetchMajorIndexLatest(code, label);
    }

    const out = data.output;
    const prpr = Number(out.bstp_nmix_prpr || 0);
    const prdy_vrss = Number(out.prdy_vrss || 0);
    const direction: "up" | "down" | "flat" = prdy_vrss > 0 ? "up" : prdy_vrss < 0 ? "down" : "flat";

    return {
      label,
      value: prpr.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      change: (prdy_vrss > 0 ? "+" : "") + prdy_vrss.toFixed(2),
      changePercent: (prdy_vrss > 0 ? "+" : "") + (out.bstp_nmix_prdy_ctrt || "0.00") + "%",
      direction,
      advanceCount: Number(out.ascn_is_cnt || 0),
      declineCount: Number(out.decn_is_cnt || 0),
    };
  } catch (error) {
    console.error(`fetchMajorIndex(${code}) exception:`, error);
    return null;
  }
}

/**
 * 지표의 최신 데이터를 가져옵니다 (장 종료 시 대응)
 * TR_ID: FHPST01740000 (국내지수 일별시세)
 */
async function fetchMajorIndexLatest(code: string, label: string): Promise<IndexPriceData | null> {
  const token = await getAccessToken();
  const appKey = process.env.KIS_APP_KEY!;
  const appSecret = process.env.KIS_APP_SECRET!;

  const url = `${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-daily-indexprice?FID_COND_MRKT_DIV_CODE=U&FID_INPUT_ISCD=${code}&FID_PERIOD_DIV_CODE=D`;

  const headers = {
    "Content-Type": "application/json",
    authorization: `Bearer ${token}`,
    appkey: appKey,
    appsecret: appSecret,
    tr_id: "FHPST01740000",
    custtype: "P",
  };

  try {
    const res = await fetch(url, { headers, cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.rt_cd !== "0" || !data.output1 || !data.output1[0]) {
      console.error(`fetchMajorIndexLatest(${label}) KIS 에러: [${data.rt_cd}] ${data.msg1}`);
      return null;
    }

    const out = data.output1[0]; // 최신 영업일
    const prpr = Number(out.bstp_nmix_prpr || 0);
    const prdy_vrss = Number(out.prdy_vrss || 0);
    const direction: "up" | "down" | "flat" = prdy_vrss > 0 ? "up" : prdy_vrss < 0 ? "down" : "flat";

    return {
      label,
      value: prpr.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      change: (prdy_vrss > 0 ? "+" : "") + prdy_vrss.toFixed(2),
      changePercent: (prdy_vrss > 0 ? "+" : "") + (out.bstp_nmix_prdy_ctrt || "0.00") + "%",
      direction
    };
  } catch (error) {
    return null;
  }
}

/**
 * 주요 환율 정보를 가져옵니다. (원/달러)
 */
export async function fetchExchangeRate(): Promise<IndexPriceData | null> {
  const token = await getAccessToken();
  const appKey = process.env.KIS_APP_KEY!;
  const appSecret = process.env.KIS_APP_SECRET!;

  const url = `${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-daily-indexprice?FID_COND_MRKT_DIV_CODE=X&FID_INPUT_ISCD=FX@KRW&FID_PERIOD_DIV_CODE=D`;

  const headers = {
    "Content-Type": "application/json",
    authorization: `Bearer ${token}`,
    appkey: appKey,
    appsecret: appSecret,
    tr_id: "FHPST04010100",
    custtype: "P",
  };

  try {
    const res = await fetch(url, { headers, cache: "no-store" });
    if (!res.ok) return null;

    const data = await res.json();
    if (data.rt_cd !== "0" || !data.output1) {
      console.error(`fetchExchangeRate KIS 에러: [${data.rt_cd}] ${data.msg1}`);
      return null;
    }

    const out = Array.isArray(data.output1) ? data.output1[0] : data.output1;
    const prpr = Number(out.ovrs_nmix_prpr || 0);
    const prdy_vrss = Number(out.prdy_vrss || 0);
    const direction: "up" | "down" | "flat" = prdy_vrss > 0 ? "up" : prdy_vrss < 0 ? "down" : "flat";

    return {
      label: "원/달러",
      value: prpr.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      change: (prdy_vrss > 0 ? "+" : "") + prdy_vrss.toFixed(2),
      changePercent: (prdy_vrss > 0 ? "+" : "") + (out.ovrs_nmix_prdy_ctrt || "0.00") + "%",
      direction
    };
  } catch (error) {
    return null;
  }
}

/**
 * 국내 증시자금 종합 데이터를 가져옵니다. (고객예탁금 등)
 */
export async function fetchMarketFunds(): Promise<MarketFundsData | null> {
  const token = await getAccessToken();
  const appKey = process.env.KIS_APP_KEY!;
  const appSecret = process.env.KIS_APP_SECRET!;

  const url = `${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/mktfunds`;

  const headers = {
    "Content-Type": "application/json",
    authorization: `Bearer ${token}`,
    appkey: appKey,
    appsecret: appSecret,
    tr_id: "FHPTJ04500000",
    custtype: "P",
  };

  try {
    const res = await fetch(url, { headers, cache: "no-store" });
    if (!res.ok) return null;

    const data = await res.json();
    if (data.rt_cd !== "0" || !data.output) return null;

    const latest = Array.isArray(data.output) ? data.output[0] : data.output;

    return {
      date: latest.stck_bsop_date,
      deposit: Number(latest.cstmr_u_ast_amt || 0),
      margin_loan: Number(latest.shcl_und_amt || 0),
      misu: Number(latest.entr_asst_amt || 0),
    };
  } catch (error) {
    return null;
  }
}

/**
 * 신용잔고 일별 추이를 가져옵니다.
 */
export async function fetchDailyCreditBalance(days = 20): Promise<CreditBalanceData[]> {
  const token = await getAccessToken();
  const appKey = process.env.KIS_APP_KEY!;
  const appSecret = process.env.KIS_APP_SECRET!;

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - (days + 20));

  const startStr = formatYYYYMMDD(startDate);
  const endStr = formatYYYYMMDD(endDate);

  const url = `${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/daily-credit-balance?FID_COND_MRKT_DIV_CODE=J&FID_INPUT_ISCD=0000&FID_INPUT_DATE_1=${startStr}&FID_INPUT_DATE_2=${endStr}&FID_PERIOD_DIV_CODE=D`;

  const headers = {
    "Content-Type": "application/json",
    authorization: `Bearer ${token}`,
    appkey: appKey,
    appsecret: appSecret,
    tr_id: "FHKST03030100",
    custtype: "P",
  };

  try {
    const res = await fetch(url, { headers, cache: "no-store" });
    if (!res.ok) return [];

    const data = await res.json();
    if (data.rt_cd !== "0" || !data.output) return [];

    return (data.output as any[]).slice(0, days).map(item => ({
      date: item.stck_bsop_date,
      amount: Number(item.shcl_und_amt || 0),
      ratio: Number(item.shcl_und_amt_icrt || 0),
    })).reverse();
  } catch (error) {
    return [];
  }
}

/**
 * 외국인/기관 순매수 상위 종목을 가져옵니다.
 */
export async function fetchInvestorRanking(type: '1' | '2', market = '0001'): Promise<InvestorFlowData[]> {
  const token = await getAccessToken();
  const appKey = process.env.KIS_APP_KEY!;
  const appSecret = process.env.KIS_APP_SECRET!;

  const url = `${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-investor?FID_COND_MRKT_DIV_CODE=V&FID_INPUT_ISCD=${market}&FID_DIV_CLS_CODE=1&FID_RANK_SORT_CLS_CODE=0&FID_ETC_CLS_CODE=${type}`;

  const headers = {
    "Content-Type": "application/json",
    authorization: `Bearer ${token}`,
    appkey: appKey,
    appsecret: appSecret,
    tr_id: "FHPTJ04400000", // 투자자매매가집계
    custtype: "P",
  };

  try {
    const res = await fetch(url, { headers, cache: "no-store" });
    if (!res.ok) return [];

    const data = await res.json();
    if (data.rt_cd !== "0" || !data.output) return [];

    return (data.output as any[]).slice(0, 20).map(item => ({
      rank: Number(item.data_rank),
      code: item.mksc_shrn_iscd,
      name: item.hts_kor_isnm,
      price: Number(item.stck_prpr),
      change: Number(item.prdy_vrss),
      changePercent: Number(item.prdy_ctrt),
      volume: Number(item.acml_vol),
      amount: Number(item.frgn_ntby_amt || item.orgn_ntby_amt || 0),
    }));
  } catch (error) {
    return [];
  }
}
