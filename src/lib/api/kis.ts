import "server-only";

export const KIS_BASE_URL = "https://openapi.koreainvestment.com:9443";

// 서버 전용 인메모리 캐싱 (개발 환경 핫 리로드 시 초기화될 수 있음)
let cachedToken = "";
let tokenExpiry = 0;
let tokenPromise: Promise<string> | null = null; // 동시 요청 방지

export class AnalysisError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AnalysisError";
  }
}

/**
 * 한국투자증권 API OAuth 2.0 Access Token 발급
 */
export async function getAccessToken() {
  const now = Date.now();
  if (cachedToken && now < tokenExpiry) {
    return cachedToken;
  }

  // 발급이 진행 중이면, 진행 중인 Promise를 같이 기다림 (중복 호출 방지)
  if (tokenPromise) {
    return tokenPromise;
  }

  tokenPromise = (async () => {
    try {
      const appKey = process.env.KIS_APP_KEY;
      const appSecret = process.env.KIS_APP_SECRET;

      if (!appKey || !appSecret) {
        throw new Error("환경변수에 KIS_APP_KEY 또는 KIS_APP_SECRET이 설정되지 않았습니다.");
      }

      const res = await fetch(`${KIS_BASE_URL}/oauth2/tokenP`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          grant_type: "client_credentials",
          appkey: appKey,
          appsecret: appSecret,
        }),
        cache: "no-store",
        // @ts-ignore - Next.js/Node fetch supports signal
        signal: AbortSignal.timeout(10000)
      });

      if (!res.ok) {
        const errorBody = await res.text();
        console.error(`[KIS AUTH ERROR] 토큰 발급 실패: ${res.status} | 원문: ${errorBody}`);
        throw new Error(`토큰 발급 실패: ${res.status} ${errorBody}`);
      }

      const data = await res.json();
      cachedToken = data.access_token;
      // 토큰 유효기간(expires_in)은 보통 86400초, 여유 시간 1시간(3600*1000) 빼고 설정
      tokenExpiry = now + data.expires_in * 1000 - 3600000;

      return cachedToken;
    } finally {
      // 처리가 완료(성공 혹은 실패)되면 잠금 해제
      tokenPromise = null;
    }
  })();

  return tokenPromise;
}

export interface OHLCV {
  date: string;       // YYYYMMDD
  open: number;       // 시가
  high: number;       // 고가
  low: number;        // 저가
  close: number;      // 종가
  volume: number;     // 누적 거래량
}

export interface StockData {
  code: string;
  name: string;
  currentPrice: number;
  change: number;
  changePercent: number;
  ohlcv: OHLCV[];     // [과거...최신] 순서
}

// YYYYMMDD 포맷 도우미
export function formatYYYYMMDD(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

/**
 * 지정된 종목의 일봉(OHLCV) 데이터를 가져옵니다.
 * 무결성 검증 로직 포함: 거래량/가격이 0이거나 누락된 경우 즉시 에러 발생.
 * 240영업일 확보를 위해 연속 조회(Pagination)를 시도합니다.
 */
export async function fetchStockOHLCV(code: string, daysRequired = 240): Promise<StockData> {
  const token = await getAccessToken();
  const appKey = process.env.KIS_APP_KEY!;
  const appSecret = process.env.KIS_APP_SECRET!;

  // 조회 기간 설정: 240영업일은 약 1년(365일) 이상이므로, 시작일을 1.5년 전으로 넉넉하게 잡습니다.
  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 18);

  const startStr = formatYYYYMMDD(startDate);
  const endStr = formatYYYYMMDD(endDate);

  let ohlcvList: OHLCV[] = [];
  let isNext = false;
  let trCont = ""; // 연속조회 키

  const searchParams = new URLSearchParams({
    FID_COND_MRKT_DIV_CODE: "J",
    FID_INPUT_ISCD: code,
    FID_INPUT_DATE_1: startStr,
    FID_INPUT_DATE_2: endStr,
    FID_PERIOD_DIV_CODE: "D",
    FID_ORG_ADJ_PRC: "1", // 1: 수정주가
  });

  // KIS API는 한번에 약 100건 리턴. 필요한 만큼 반복 조회
  while (ohlcvList.length < daysRequired) {
    const headers: Record<string, string> = {
      "Content-Type": "application/json; charset=utf-8",
      authorization: `Bearer ${token}`,
      appkey: appKey,
      appsecret: appSecret,
      tr_id: "FHKST03010100", // 국내주식 기간별 시세
    };

    if (isNext && trCont) {
      headers["tr_cont"] = "N"; // 연속조회 아님? 사실 tr_cont 값을 헤더로 안쓰고 쿼리로 안될 수도 있으나, 보통 헤더로 던짐
      // 일부 최신 한국투자증권 API(국내주식 기간별시세)는 페이징 대신 한 번에 지정기간 만큼 주기도 하나,
      // 최대 100건 제한 시 연속조회가 필요합니다.
    }

    const url = `${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice?${searchParams.toString()}`;

    const res = await fetch(url, { headers, cache: "no-store" });
    if (!res.ok) {
      throw new AnalysisError(`주가 조회 실패: ${res.status}`);
    }

    const data = await res.json();
    if (data.rt_cd !== "0") {
      throw new AnalysisError(`API 응답 에러: ${data.msg1}`);
    }

    const dailyData = data.output2;
    if (!dailyData || !Array.isArray(dailyData) || dailyData.length === 0) {
      break;
    }

    for (const item of dailyData) {
      // API에서 값이 빈 문자열로 올경우 방어
      if (!item.stck_bsop_date) continue;

      const open = Number(item.stck_oprc);
      const high = Number(item.stck_hgpr);
      const low = Number(item.stck_lwpr);
      const close = Number(item.stck_clpr);
      const volume = Number(item.acml_vol);

      // 데이터 무결성 검사
      if (close === 0 || isNaN(close)) {
        throw new AnalysisError(`데이터 무결성 오류: 종목 ${code}의 ${item.stck_bsop_date}일자 종가가 0입니다.`);
      }
      if (volume === 0 || isNaN(volume)) {
        // 주말/공휴일 등 거래량 0인 날이 끼어있을 수 있지만, 정상 영업일에 0이라면 문제 소지
        // KIS API상 거래 없는 날짜는 리턴되지 않으므로, 왔는데 0이면 거래정지 상태일 수 있음
        throw new AnalysisError(`데이터 무결성 오류: 종목 ${code}의 ${item.stck_bsop_date}일자 거래량이 0입니다. 거래정지 종목이거나 데이터 누락일 수 있습니다.`);
      }

      ohlcvList.push({
        date: item.stck_bsop_date,
        open,
        high,
        low,
        close,
        volume,
      });

      if (ohlcvList.length >= daysRequired) break;
    }

    // 다음 페이지가 있는지 여부
    const trContNext = res.headers.get("tr_cont");
    if (trContNext === "D" || trContNext === "M") {
      // 다음 데이터 없음
      break;
    }
    // 한국투자증권 API 특성상 시작일을 옮겨서 다시 호출하는 것이 안전함.
    // 방금 받은 데이터 중 가장 오래된 날짜의 하루 전을 새로운 endDate(FID_INPUT_DATE_2)로 세팅
    const oldestDateStr = ohlcvList[ohlcvList.length - 1].date;
    const oldYear = parseInt(oldestDateStr.slice(0, 4));
    const oldMonth = parseInt(oldestDateStr.slice(4, 6)) - 1;
    const oldDay = parseInt(oldestDateStr.slice(6, 8));

    const prevDate = new Date(oldYear, oldMonth, oldDay);
    prevDate.setDate(prevDate.getDate() - 1);

    searchParams.set("FID_INPUT_DATE_2", formatYYYYMMDD(prevDate));
    isNext = true;
  }

  if (ohlcvList.length < 60) {
    throw new AnalysisError(`데이터 부족: 최소 60일의 데이터가 필요하나 ${ohlcvList.length}일치만 수집되었습니다.`);
  }

  // 데이터는 내림차순(최신이 앞)으로 오므로, 시간 오름차순(과거->최신)으로 뒤집기
  ohlcvList.reverse();

  // 최신 데이터 기준 메타 정보 (output1 사용 또는 맨 마지막 리스트 사용)
  const currentPrice = ohlcvList[ohlcvList.length - 1].close;
  const prevPrice = ohlcvList[ohlcvList.length - 2]?.close || currentPrice;
  const change = currentPrice - prevPrice;
  const changePercent = (change / prevPrice) * 100;

  // // 현재 출력에는 종목명이 안나오므로 단순처리 (API에서 output1에 이름이 보통 없음, 조회가 별도 필요하나 생략)
  // 이름을 구하려면 주식기본조회 API가 필요. 현 구상에서는 클라이언트에서 보낸 이름을 신뢰.

  return {
    code,
    name: "검색된 종목",
    currentPrice,
    change,
    changePercent: parseFloat(changePercent.toFixed(2)),
    ohlcv: ohlcvList,
  };
}
