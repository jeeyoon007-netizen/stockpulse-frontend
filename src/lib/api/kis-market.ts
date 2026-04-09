import { getAccessToken, KIS_BASE_URL, formatYYYYMMDD } from "./kis";

/**
 * 전역 유틸리티: 타임아웃이 포함된 fetch
 */
async function fetchWithTimeout(url: string, options: RequestInit, timeout = 5000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

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
    tr_id: "FHPUP02100000",
    custtype: "P",
  };

  try {
    const res = await fetchWithTimeout(url, { headers, cache: "no-store" });
    if (!res.ok) {
        console.error(`fetchMajorIndex(${label}) HTTP 에러: ${res.status}`);
        return null;
    }

    const data = await res.json();

    if (data.rt_cd !== "0" || !data.output) {
      console.warn(`fetchMajorIndex(${label}) KIS 응답 에러: [${data.rt_cd}] ${data.msg1}. 일별 시세 전환.`);
      return fetchMajorIndexLatest(code, label);
    }

    const out = data.output;
    const prpr = Number(out.bstp_nmix_prpr || 0);
    const prdy_vrss = Number(out.bstp_nmix_prdy_vrss || 0);
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
    const prdy_vrss = Number(out.bstp_nmix_prdy_vrss || 0);
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
 * 한국은행 ECOS Open API를 사용하도록 변경됨
 */
export async function fetchExchangeRate(): Promise<IndexPriceData | null> {
  const BOK_API_KEY = process.env.BOK_API_KEY || "D7Z1MD14MIETKMYQBYYB";
  
  const today = new Date();
  const past = new Date();
  past.setDate(today.getDate() - 14); // 주말, 휴일 감안하여 14일 전부터 조회
  
  const startStr = formatYYYYMMDD(past);
  const endStr = formatYYYYMMDD(today);

  // 한국은행 ECOS 연계: 731Y001 (주요국 통화의 대원화환율), 0000001 (원/미국달러 매매기준율)
  const url = `http://ecos.bok.or.kr/api/StatisticSearch/${BOK_API_KEY}/json/kr/1/10/731Y001/D/${startStr}/${endStr}/0000001`;

  try {
    const res = await fetchWithTimeout(url, { cache: "no-store" }, 7000);
    if (!res.ok) return null;

    const data = await res.json();
    
    if (!data.StatisticSearch || !data.StatisticSearch.row || data.StatisticSearch.row.length < 2) {
      console.error(`fetchExchangeRate 한국은행 API 에러: 데이터 부족`);
      return null;
    }

    const rows = data.StatisticSearch.row;
    // BOK ECOS API는 보통 날짜 오름차순으로 제공. 마지막 원소가 가장 최신 영업일.
    const latest = rows[rows.length - 1];
    const previous = rows[rows.length - 2];

    const prpr = Number(latest.DATA_VALUE || 0);
    const prevPrpr = Number(previous.DATA_VALUE || 0);
    
    // 전일 대비 증감 및 등락률 계산
    const prdy_vrss = Number((prpr - prevPrpr).toFixed(2));
    const prdy_ctrt = Number(((prdy_vrss / prevPrpr) * 100).toFixed(2));
    const direction: "up" | "down" | "flat" = prdy_vrss > 0 ? "up" : prdy_vrss < 0 ? "down" : "flat";

    return {
      label: "원/달러",
      value: prpr.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      change: (prdy_vrss > 0 ? "+" : "") + prdy_vrss.toFixed(2),
      changePercent: (prdy_vrss > 0 ? "+" : "") + prdy_ctrt.toFixed(2) + "%",
      direction
    };
  } catch (error) {
    console.error("fetchExchangeRate exception:", error);
    return null;
  }
}

/**
 * 국내 증시자금 종합 데이터를 가져옵니다. (고객예탁금 등)
 * TR_ID: FHKST649100C0
 */
export async function fetchMarketFunds(): Promise<MarketFundsData | null> {
  const token = await getAccessToken();
  const appKey = process.env.KIS_APP_KEY!;
  const appSecret = process.env.KIS_APP_SECRET!;

  // FID_INPUT_DATE_1은 생략 시 최근 영업일
  const url = `${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/mktfunds?FID_INPUT_DATE_1=`;

  const headers = {
    "Content-Type": "application/json",
    authorization: `Bearer ${token}`,
    appkey: appKey,
    appsecret: appSecret,
    tr_id: "FHKST649100C0",
    custtype: "P",
  };

  try {
    const res = await fetchWithTimeout(url, { headers, cache: "no-store" });
    if (!res.ok) return null;

    const data = await res.json();
    if (data.rt_cd !== "0" || !data.output) {
        console.error(`fetchMarketFunds KIS 에러: [${data.rt_cd}] ${data.msg1}`);
        return null;
    }

    const latest = data.output; // FHKST649100C0는 output이 배열이 아닌 객체로 올 수 있음

    return {
      date: latest.stck_bsop_date || "",
      deposit: Number(latest.cstmr_u_ast_amt || 0) * 100000000, // 억원 단위 -> 원 단위 환산
      margin_loan: Number(latest.shcl_und_amt || 0) * 100000000,
      misu: Number(latest.entr_asst_amt || 0) * 100000000,
    };
  } catch (error) {
    console.error("fetchMarketFunds exception:", error);
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

  const url = `${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/daily-credit-balance?FID_COND_MRKT_DIV_CODE=J&FID_COND_SCR_DIV_CODE=20476&FID_INPUT_ISCD=0000&FID_INPUT_DATE_1=${startStr}&FID_PERIOD_DIV_CODE=D`;

  const headers = {
    "Content-Type": "application/json",
    authorization: `Bearer ${token}`,
    appkey: appKey,
    appsecret: appSecret,
    tr_id: "FHPST01740000",
    custtype: "P",
  };

  try {
    const res = await fetchWithTimeout(url, { headers, cache: "no-store" });
    if (!res.ok) return [];

    const data = await res.json();
    if (data.rt_cd !== "0" || !data.output) {
        console.error(`fetchDailyCreditBalance KIS 에러: [${data.rt_cd}] ${data.msg1}`);
        return [];
    }

    return (data.output as any[]).slice(0, days).map(item => ({
      date: item.stck_bsop_date,
      amount: Number(item.shcl_und_amt || 0) * 100000000, // 억원 단위 -> 원 단위 환산
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

/**
 * 당일 52주 신고가 종목 수를 가져옵니다.
 * TR_ID: FHKST01010700 (국내주식 신고가/신저가)
 */
export async function fetchNewHighCount(): Promise<number> {
  const token = await getAccessToken();
  const appKey = process.env.KIS_APP_KEY!;
  const appSecret = process.env.KIS_APP_SECRET!;

  const fetchMarketHigh = async (market: 'J' | 'Q') => {
    // psearch-high-low 엔드포인트 사용
    const url = `${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/psearch-high-low?FID_COND_MRKT_DIV_CODE=${market}&FID_INPUT_ISCD=0000&FID_DIV_CLS_CODE=0&FID_RANK_SORT_CLS_CODE=0&FID_ETC_CLS_CODE=0`;

    const headers = {
      "Content-Type": "application/json",
      authorization: `Bearer ${token}`,
      appkey: appKey,
      appsecret: appSecret,
      tr_id: "FHKST01010700",
      custtype: "P",
    };

    try {
      const res = await fetchWithTimeout(url, { headers, cache: "no-store" });
      if (!res.ok) return 0;
      const data = await res.json();
      if (data.rt_cd !== "0" || !data.output) return 0;
      return Array.isArray(data.output) ? data.output.length : 0;
    } catch {
      return 0;
    }
  };

  const [kospiCount, kosdaqCount] = await Promise.all([
    fetchMarketHigh('J'),
    fetchMarketHigh('Q')
  ]);

  return kospiCount + kosdaqCount;
}

/**
 * 특정 종목의 상세 정보(시가총액, 업종 등)를 가져옵니다.
 * TR_ID: FHKST01010100 (주식현재가 시세)
 */
export async function fetchStockDetail(code: string) {
  const token = await getAccessToken();
  const appKey = process.env.KIS_APP_KEY!;
  const appSecret = process.env.KIS_APP_SECRET!;

  const url = `${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-price?FID_COND_MRKT_DIV_CODE=J&FID_INPUT_ISCD=${code}`;

  const headers = {
    "Content-Type": "application/json",
    authorization: `Bearer ${token}`,
    appkey: appKey,
    appsecret: appSecret,
    tr_id: "FHKST01010100",
    custtype: "P",
  };

  try {
    const res = await fetch(url, { headers, cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.rt_cd !== "0" || !data.output) return null;

    return {
      name: data.output.hts_kor_isnm,
      industry: data.output.bstp_kor_isnm,
      marketCap: Number(data.output.hts_avls || 0), // 시가총액 (억 단위)
      currentPrice: Number(data.output.stck_prpr || 0),
    };
  } catch {
    return null;
  }
}
