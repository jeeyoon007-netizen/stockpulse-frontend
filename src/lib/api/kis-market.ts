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
  };

  try {
    const res = await fetch(url, { headers, cache: "no-store" });
    if (!res.ok) return null;

    const data = await res.json();
    if (data.rt_cd !== "0" || !data.output) return null;

    const out = data.output;
    const prdy_vrss = Number(out.prdy_vrss); // 전일 대비
    const direction: "up" | "down" | "flat" = prdy_vrss > 0 ? "up" : prdy_vrss < 0 ? "down" : "flat";

    return {
      label,
      value: Number(out.bstp_nmix_prpr).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      change: (prdy_vrss > 0 ? "+" : "") + prdy_vrss.toFixed(2),
      changePercent: (prdy_vrss > 0 ? "+" : "") + out.bstp_nmix_prdy_ctrt + "%",
      direction
    };
  } catch (error) {
    console.error(`fetchMajorIndex(${code}) error:`, error);
    return null;
  }
}

/**
 * 주요 환율 정보를 가져옵니다. (원/달러)
 * TR_ID: FHPST04010100 (외환/금리 가격)
 */
export async function fetchExchangeRate(): Promise<IndexPriceData | null> {
  const token = await getAccessToken();
  const appKey = process.env.KIS_APP_KEY!;
  const appSecret = process.env.KIS_APP_SECRET!;

  // FID_INPUT_ISCD=FX@KRW (원/달러)
  const url = `${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-daily-indexprice?FID_COND_MRKT_DIV_CODE=X&FID_INPUT_ISCD=FX@KRW&FID_PERIOD_DIV_CODE=D`;

  const headers = {
    "Content-Type": "application/json",
    authorization: `Bearer ${token}`,
    appkey: appKey,
    appsecret: appSecret,
    tr_id: "FHPST04010100",
  };

  try {
    const res = await fetch(url, { headers, cache: "no-store" });
    if (!res.ok) return null;

    const data = await res.json();
    if (data.rt_cd !== "0" || !data.output1) return null;

    const out = data.output1;
    const prdy_vrss = Number(out.prdy_vrss);
    const direction: "up" | "down" | "flat" = prdy_vrss > 0 ? "up" : prdy_vrss < 0 ? "down" : "flat";

    return {
      label: "원/달러",
      value: Number(out.ovrs_nmix_prpr).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      change: (prdy_vrss > 0 ? "+" : "") + prdy_vrss.toFixed(2),
      changePercent: (prdy_vrss > 0 ? "+" : "") + out.ovrs_nmix_prdy_ctrt + "%",
      direction
    };
  } catch (error) {
    console.error("fetchExchangeRate error:", error);
    return null;
  }
}

/**
 * 국내 증시자금 종합 데이터를 가져옵니다. (고객예탁금 등)
 * TR_ID: FHPTJ04500000
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

    // output에서 최신 한건만 사용 (보통 리스트로 옴)
    const latest = Array.isArray(data.output) ? data.output[0] : data.output;
    
    return {
      date: latest.stck_bsop_date,
      deposit: Number(latest.cstmr_u_ast_amt || 0),
      margin_loan: Number(latest.shcl_und_amt || 0),
      misu: Number(latest.entr_asst_amt || 0),
    };
  } catch (error) {
    console.error("fetchMarketFunds error:", error);
    return null;
  }
}

/**
 * 신용잔고 일별 추이를 가져옵니다.
 * TR_ID: FHKST03030100 (예상) - 실제 엔드포인트 URL 기준 처리
 */
export async function fetchDailyCreditBalance(days = 20): Promise<CreditBalanceData[]> {
  const token = await getAccessToken();
  const appKey = process.env.KIS_APP_KEY!;
  const appSecret = process.env.KIS_APP_SECRET!;

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - (days + 10)); // 여유있게 조회

  const startStr = formatYYYYMMDD(startDate);
  const endStr = formatYYYYMMDD(endDate);

  const url = `${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/daily-credit-balance?FID_COND_MRKT_DIV_CODE=J&FID_INPUT_ISCD=0000&FID_INPUT_DATE_1=${startStr}&FID_INPUT_DATE_2=${endStr}&FID_PERIOD_DIV_CODE=D`;

  const headers = {
    "Content-Type": "application/json",
    authorization: `Bearer ${token}`,
    appkey: appKey,
    appsecret: appSecret,
    tr_id: "FHKST03030100", // 신용잔고 일별
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
    })).reverse(); // 과거 -> 최신 순
  } catch (error) {
    console.error("fetchDailyCreditBalance error:", error);
    return [];
  }
}

/**
 * 외국인/기관 순매수 상위 종목을 가져옵니다.
 * type: 1 (외국인), 2 (기관)
 * market: 0001 (KOSPI), 1001 (KOSDAQ)
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
    tr_id: "FHPTJ04400000",
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
    console.error("fetchInvestorRanking error:", error);
    return [];
  }
}
