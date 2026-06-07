"use server";

export type AnalysisMode = "scalp" | "swing" | "position";
export interface AIAnalysisResult {
  experts: any[];
  auditLogs: any[];
  strategy: any;
  finalVerdict: string;
  weightedScore: number;
  mode: string;
  veto: any;
  marketState: string;
  marketStateLabel: string;
  persistCycleRemaining: number;
  indicators?: any;
  swingLevels?: any[];
  wyckoffPhase?: {
    phase: string;
    confidence: number;
    description: string;
  };
}
import { supabase } from "@/lib/supabase";

import { fetchFearGreedIndex, type FearGreedResponse } from "@/lib/api/feargreed";
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

import { 
  fetchMarketFunds, 
  fetchDailyCreditBalance, 
  fetchInvestorRanking, 
  fetchMajorIndex,
  fetchExchangeRate,
  fetchStockDetail,
  fetchADRFromInfo,
  type MarketFundsData, 
  type CreditBalanceData, 
  type InvestorFlowData,
  type IndexPriceData
} from "@/lib/api/kis-market";

/**
 * 전역 캐시 설정 (서버 메모리에 상주)
 * 사용자 요청: 분당 1회 제한을 고려하여 1분 10초(70,000ms) TTL 적용
 */
const CACHE_TTL = 70 * 1000;
const GLOBAL_CACHE: Record<string, { data: any, timestamp: number }> = {};
const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || "https://stock-brv7.onrender.com";

function getCachedData(key: string) {
    const cached = GLOBAL_CACHE[key];
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
        return cached.data;
    }
    return null;
}

function setCachedData(key: string, data: any) {
    GLOBAL_CACHE[key] = { data, timestamp: Date.now() };
}

// ... (existing action)

/**
 * 수급 상황 및 특징 분석 서버 액션
 */
export async function fetchInvestorFlowAnalysisAction(market = '0001') {
    const cacheKey = `investor_flow_${market}`;
    // const cached = getCachedData(cacheKey);
    // if (cached) return cached;

    // 1. Render 백엔드 API에서 수급 데이터(뱃지 포함) 우선 수집 시도
    try {
        const renderBackendUrl = `https://stock-brv7.onrender.com/api/v1/market/investor-flow?market=${market}`;
        console.log(`[ACTION] Render 백엔드 API 호출 시도: ${renderBackendUrl}`);
        const response = await fetch(renderBackendUrl, { cache: "no-store" });
        if (response.ok) {
            const renderData = await response.json();
            if (renderData && (renderData.foreignTop10 || renderData.instTop10)) {
                console.log(`[ACTION] Render 백엔드 API에서 수급 데이터 로드 완료 (뱃지 포함)`);
                setCachedData(cacheKey, renderData);
                return renderData;
            }
        }
    } catch (err) {
        console.warn("[ACTION] Render 백엔드 API 호출 실패, KIS 직접 수집으로 폴백합니다:", err);
    }

    // 2. 폴백: 한국투자증권 API 직접 호출 및 자체 분석
    try {
        console.log(`[ACTION] fetchInvestorRanking 호출 시작 (${market})...`);
        const [foreign, institutional] = await Promise.all([
            fetchInvestorRanking('1', market),
            fetchInvestorRanking('2', market)
        ]);
        console.log(`[ACTION] API 응답 수신: 외인=${foreign.length}, 기관=${institutional.length}`);

        const foreignTop10 = foreign.slice(0, 10);
        const instTop10 = institutional.slice(0, 10);

        const uniqueCodes = Array.from(new Set([
            ...foreignTop10.map(s => s.code),
            ...instTop10.map(s => s.code)
        ]));

        // [순차 처리] KIS API TPS 제한을 피하기 위해 0.2초 간격으로 순차 요청
        const detailMap = new Map();
        console.log(`[ANALYSIS] Analyzing ${uniqueCodes.length} stocks for market ${market}...`);
        
        for (const code of uniqueCodes) {
            // 주식현재가 API는 코스닥 종목도 'J' 코드를 사용해야 함
            const d = await fetchStockDetail(code, 'J');
            if (d) detailMap.set(code, d);
            await delay(200); 
        }

        const overlap = foreignTop10
            .filter(f => instTop10.some(i => i.code === f.code))
            .map(s => ({ name: s.name, code: s.code, badge: s.badge }));

        const industryCount: Record<string, number> = {};
        detailMap.forEach(d => {
            if (d.industry) {
                industryCount[d.industry] = (industryCount[d.industry] || 0) + 1;
            }
        });
        const dominantIndustries = Object.entries(industryCount)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 2)
            .map(([name]) => name);

        const highTurnover = Array.from(detailMap.entries())
            .filter(([code, detail]) => {
                const stock = [...foreignTop10, ...instTop10].find(s => s.code === code);
                if (!stock || detail.marketCap === 0) return false;
                
                // 단위 보정: stock.amount(원)를 억 단위로 환산하여 시총(억)과 비교
                const amountInEok = stock.amount / 100000000;
                const ratio = (amountInEok / detail.marketCap) * 100; // 백분율(%)
                
                console.log(`[ANALYSIS] ${stock.name}: 수급=${amountInEok.toFixed(1)}억 / 시총=${detail.marketCap}억 -> 비중=${ratio.toFixed(4)}%`);
                
                // 시장별 임계치 차별화: 코스닥은 더 엄격하게 0.5%
                const threshold = market === '1001' ? 0.5 : 0.15;
                return ratio > threshold;
            })
            .map(([code, d]) => {
                const stock = [...foreignTop10, ...instTop10].find(s => s.code === code);
                return { name: stock?.name || d.name || "알 수 없음", code, badge: stock?.badge };
            });

        console.log(`[ACTION] Final HighTurnover Results [${highTurnover.length}]: ${highTurnover.map(h => h.name).join(", ")}`);

        const result = {
            foreignTop10,
            instTop10,
            overlap,
            dominantIndustries,
            highTurnover
        };

        setCachedData(cacheKey, result);
        return result;
    } catch (error) {
        console.error("fetchInvestorFlowAnalysisAction error:", error);
        return {
            foreignTop10: [], instTop10: [], overlap: [], dominantIndustries: [], highTurnover: []
        };
    }
}

export interface StockAnalysisResponse {
  success: boolean;
  stockData?: any; // KIS Data
  analysis?: AIAnalysisResult;
  error?: string;
}

/**
 * [마켓 오버뷰] 상단 지수 4종 서버 액션
 */
export async function fetchMarketOverviewAction(): Promise<IndexPriceData[]> {
  const cached = getCachedData('market_overview');
  if (cached) return cached;

  // 1. 백엔드 브릿지 경로
  try {
    const res = await fetch(`${BACKEND_URL}/api/v1/market/overview`, { cache: 'no-store', signal: AbortSignal.timeout(4000) });
    if (res.status === 202) {
      const retryData = await res.json();
      if (retryData.retryAfter) {
         console.log(`[ACTION] 마켓 오버뷰 초기화 중... ${retryData.retryAfter}초 대기 후 재시도`);
         await delay(retryData.retryAfter * 1000);
         return fetchMarketOverviewAction();
      }
    }
    if (res.ok) {
      const data = await res.json();
      console.log("[ACTION] [BRIDGE] 백엔드로부터 마켓 오버뷰 지수 로드 성공");
      setCachedData('market_overview', data);
      return data;
    }
  } catch (bridgeErr: any) {
    console.warn("[ACTION] [BRIDGE] 마켓 오버뷰 브릿지 실패, 폴백합니다:", bridgeErr.message);
  }

  // 2. KIS API 직접 호출 폴백 경로
  try {
    const results = await Promise.all([
      fetchMajorIndex("0001", "코스피").catch(() => null),
      fetchMajorIndex("1001", "코스닥").catch(() => null),
      fetchMajorIndex("2001", "코스피200").catch(() => null),
      fetchExchangeRate().catch(() => null),
    ]);

    const activeResults = results.filter((r): r is IndexPriceData => r !== null);
    
    if (activeResults.length === 0) {
        console.warn("모든 시장 지수 API 호출에 실패했습니다.");
        return [
          { label: "코스피", value: "데이터 없음", change: "0.00", changePercent: "0.00%", direction: "flat" },
          { label: "코스닥", value: "데이터 없음", change: "0.00", changePercent: "0.00%", direction: "flat" },
          { label: "코스피200", value: "데이터 없음", change: "0.00", changePercent: "0.00%", direction: "flat" },
          { label: "원/달러", value: "데이터 없음", change: "0.00", changePercent: "0.00%", direction: "flat" },
        ];
    }
    
    setCachedData('market_overview', activeResults);
    return activeResults;
  } catch (error) {
    console.error("fetchMarketOverviewAction exception:", error);
    return [];
  }
}

export async function analyzeStockAction(code: string, mode: AnalysisMode = "scalp", stockName?: string): Promise<StockAnalysisResponse> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/v1/analysis/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ code, mode, stock_name: stockName }),
      cache: 'no-store'
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody.error || `백엔드 분석 실패: ${res.status}`);
    }

    const data = await res.json();
    return data;
  } catch (error: any) {
    console.error("analyzeStockAction error:", error);
    return { success: false, error: error.message || "알 수 없는 에러가 발생했습니다." };
  }
}

/**
 * [온도] 공포탐욕지수 서버 액션
 */
export async function fetchFearGreedAction(): Promise<FearGreedResponse | null> {
  // 1. 백엔드 브릿지 경로
  try {
    const res = await fetch(`${BACKEND_URL}/api/v1/market/fear-greed`, { cache: 'no-store', signal: AbortSignal.timeout(4000) });
    if (res.status === 202) {
      const retryData = await res.json();
      if (retryData.retryAfter) {
         console.log(`[ACTION] 공포탐욕 초기화 중... ${retryData.retryAfter}초 대기 후 재시도`);
         await delay(retryData.retryAfter * 1000);
         return fetchFearGreedAction();
      }
    }
    if (res.ok) {
      const data = await res.json();
      console.log("[ACTION] [BRIDGE] 백엔드로부터 공포탐욕지수 로드 성공");
      return data;
    }
  } catch (bridgeErr: any) {
    console.warn("[ACTION] [BRIDGE] 공포탐욕 브릿지 실패, 폴백합니다:", bridgeErr.message);
  }

  // 2. 폴백
  try {
    return await fetchFearGreedIndex().catch(() => null);
  } catch (error) {
    console.error("fetchFearGreedAction error:", error);
    return null;
  }
}

/**
 * [카나리아] 시장 자금, 신용잔고, ADR 및 신고가 서버 액션
 */
export async function fetchCanaryDataAction() {
  const cached = getCachedData('canary_data');
  if (cached) return cached;

  console.log("[ACTION] fetchCanaryDataAction 호출 시작...");

  // 1. 백엔드 브릿지 경로
  try {
    const res = await fetch(`${BACKEND_URL}/api/v1/market/canary`, { cache: 'no-store', signal: AbortSignal.timeout(5000) });
    if (res.status === 202) {
      const retryData = await res.json();
      if (retryData.retryAfter) {
         console.log(`[ACTION] 카나리아 초기화 중... ${retryData.retryAfter}초 대기 후 재시도`);
         await delay(retryData.retryAfter * 1000);
         return fetchCanaryDataAction();
      }
    }
    if (res.ok) {
      const data = await res.json();
      
      // 백엔드 캐시가 비어있으면 폴백으로 전환
      if (!data || Object.keys(data).length === 0) {
        console.warn('[ACTION] [BRIDGE] 백엔드 데이터가 비어있습니다. 폴백 경로로 전환.');
        throw new Error('빈 데이터');
      }

      console.log("[ACTION] [BRIDGE] 백엔드로부터 카나리아 데이터 로드 성공");

      // ADR: 백엔드(Render)IP 사용 없음 → Vercel 서버에서 직접 크롤링
      try {
        const adrResult = await fetchADRFromInfo();
        data.adrKospi = adrResult.kospi;
        data.adrKosdaq = adrResult.kosdaq;
        console.log(`[ACTION] ADR Vercel 크롤링: KOSPI=${adrResult.kospi?.adr || 'N/A'}%, KOSDAQ=${adrResult.kosdaq?.adr || 'N/A'}%`);
      } catch (adrErr: any) {
        console.warn('[ACTION] ADR 크롤링 실패:', adrErr.message);
      }

      setCachedData('canary_data', data);
      return data;
    }
  } catch (bridgeErr: any) {
    console.warn("[ACTION] [BRIDGE] 카나리아 데이터 브릿지 실패, 폴백합니다:", bridgeErr.message);
  }

  // 2. KIS API 직접 호출 폴백 경로
  try {
    const [funds, creditHistory, adrResult] = await Promise.all([
      fetchMarketFunds().catch(() => null),
      fetchDailyCreditBalance(20).catch(() => []),
      fetchADRFromInfo().catch(() => ({ kospi: null, kosdaq: null }))
    ]);

    console.log(`[ACTION] Canary API 결과 수신 (폴백 경로):
      - Funds: ${funds ? "성공" : "실패(null)"}
      - CreditHistory: ${creditHistory?.length || 0} items
      - ADR Data: ${adrResult ? "성공" : "실패(null)"}
    `);

    const result = { 
        funds, 
        creditHistory, 
        adrKospi: adrResult?.kospi || null,
        adrKosdaq: adrResult?.kosdaq || null,
    };

    console.log(`[ACTION] Canary 최종 데이터 생성 완료: CreditHistory ${result.creditHistory.length}건`);

    if (funds) {
        setCachedData('canary_data', result);
    }
    return result;
  } catch (error: any) {
    console.error("[ACTION] fetchCanaryDataAction 크리티컬 에러:", error.message || error);
    return { 
        funds: null, creditHistory: [], 
        adrKospi: null, adrKosdaq: null
    };
  }
}

/**
 * [수급 상황] 외국인/기관 순매수 상위 서버 액션
 */
export async function fetchInvestorFlowAction(type: '1' | '2', market = '0001'): Promise<InvestorFlowData[]> {
  try {
    return await fetchInvestorRanking(type, market);
  } catch (error) {
    console.error("fetchInvestorFlowAction error:", error);
    return [];
  }
}

/**
 * 관심종목 추가 서버 액션
 */
export async function addToWatchlistAction(nickname: string, stockCode: string, stockName: string) {
  try {
    const res = await fetch(`${BACKEND_URL}/api/v1/watchlist/add`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname, stock_code: stockCode, stock_name: stockName }),
      cache: "no-store"
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (e: any) {
    console.error("addToWatchlistAction error:", e);
    return { success: false, error: e.message || "Failed to add to watchlist" };
  }
}

/**
 * 관심종목 삭제 서버 액션
 */
export async function removeFromWatchlistAction(nickname: string, stockCode: string) {
  try {
    const res = await fetch(`${BACKEND_URL}/api/v1/watchlist/remove`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname, stock_code: stockCode }),
      cache: "no-store"
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (e: any) {
    console.error("removeFromWatchlistAction error:", e);
    return { success: false, error: e.message || "Failed to remove from watchlist" };
  }
}

/**
 * 관심종목 목록 조회 서버 액션
 */
export async function fetchWatchlistAction(nickname: string) {
  try {
    const res = await fetch(`${BACKEND_URL}/api/v1/watchlist/list?nickname=${encodeURIComponent(nickname)}`, {
      cache: "no-store"
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (e: any) {
    console.error("fetchWatchlistAction error:", e);
    return { success: false, error: e.message || "Failed to fetch watchlist" };
  }
}

/**
 * 관심종목 상세 대시보드 데이터 (Watchlist + Backtest + Wyckoff) 조회 서버 액션
 */
export async function fetchWatchlistDetailsAction(nickname: string) {
  try {
    // 1. 기본 관심종목 리스트 조회
    const watchlistRes = await fetchWatchlistAction(nickname);
    if (!watchlistRes.success || !watchlistRes.data || watchlistRes.data.length === 0) {
      return { success: true, data: [] };
    }

    const watchlists = watchlistRes.data;
    const stockCodes = watchlists.map((w: any) => w.stock_code);

    if (!supabase) throw new Error("Supabase 클라이언트가 초기화되지 않았습니다.");

    // 2. 백테스트 결과 병렬 조회
    const { data: backtests, error: backtestErr } = await supabase
      .from('backtest_results')
      .select('stock_code, best_strategy_name, win_rate, total_return, mdd, trade_count')
      .in('stock_code', stockCodes);

    if (backtestErr) console.error("Watchlist Backtest Error:", backtestErr.message);

    // 3. 최근 분석 로그 (Wyckoff 국면) 병렬 조회
    // 가장 최근 분석된 결과만 가져오기 위해 각 종목별로 최신 1건씩 가져와야 함
    // (supabase rpc 또는 in 쿼리 후 코드별 맵핑 처리)
    const { data: analysisLogs, error: logErr } = await supabase
      .from('analysis_logs')
      .select('stock_code, wyckoff_phase, wyckoff_confidence, created_at')
      .in('stock_code', stockCodes)
      .order('created_at', { ascending: false });

    if (logErr) console.error("Watchlist Analysis Logs Error:", logErr.message);

    // 중복 제거: 각 종목별 가장 최신 로그만 추출
    const latestLogsMap = new Map();
    if (analysisLogs) {
      analysisLogs.forEach(log => {
        if (!latestLogsMap.has(log.stock_code)) {
          latestLogsMap.set(log.stock_code, log);
        }
      });
    }

    const backtestMap = new Map();
    if (backtests) {
      backtests.forEach(b => backtestMap.set(b.stock_code, b));
    }

    // 4. 데이터 합성
    const combinedData = watchlists.map((w: any) => {
      const bt = backtestMap.get(w.stock_code);
      const log = latestLogsMap.get(w.stock_code);
      return {
        ...w,
        backtest: bt || null,
        wyckoff: log ? {
          phase: log.wyckoff_phase,
          confidence: log.wyckoff_confidence
        } : null
      };
    });

    return { success: true, data: combinedData };
  } catch (err: any) {
    console.error("fetchWatchlistDetailsAction error:", err);
    return { success: false, error: err.message };
  }
}

/**
 * 백테스트 타점 정보 조회 서버 액션
 * Render 서버 타임아웃/응답 절단 버그 방어를 위해 DB 직접 조회 폴백 포함
 */
export async function fetchBacktestSummaryAction(code: string) {
  // 1. 백엔드 브릿지 통신 시도 (최대 3초 대기)
  try {
    const res = await fetch(`${BACKEND_URL}/api/v1/analysis/backtest?code=${code}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(3000)
    });
    
    if (res.ok) {
      const text = await res.text();
      try {
        const json = JSON.parse(text);
        if (json.success) return json;
      } catch (parseError) {
        console.warn("[ACTION] 백엔드 JSON 파싱 실패(응답 절단 의심), DB 직접 조회로 폴백합니다.");
      }
    }
  } catch (err: any) {
    console.warn(`[ACTION] 백엔드 백테스트 API 호출 에러(${err.message}), DB 직접 조회로 폴백합니다.`);
  }

  // 2. 백엔드 통신 실패 시 Supabase DB 직접 조회 (강력한 Fallback)
  try {
    if (!supabase) throw new Error("Supabase 클라이언트가 초기화되지 않았습니다.");
    const { data: results, error: resError } = await supabase
      .from('backtest_results')
      .select('*')
      .eq('stock_code', code)
      .single();

    if (resError && resError.code !== 'PGRST116') throw resError;
    
    if (!results) {
      return { success: true, data: null }; // 데이터가 아예 없음
    }

    const { data: trades, error: tradesError } = await supabase
      .from('backtest_trades')
      .select('*')
      .eq('stock_code', code);
      
    if (tradesError) throw tradesError;

    return {
      success: true,
      data: {
        ...results,
        trades: trades || []
      }
    };
  } catch (err: any) {
    console.error("[ACTION] DB 직접 조회 백테스트 에러:", err.message);
    return { success: false, error: err.message };
  }
}

export async function getDebugInfoAction() {
  return {
    BACKEND_URL,
    supabaseInitialized: !!supabase,
    envKeys: Object.keys(process.env).filter(k => k.includes("SUPABASE") || k.includes("BACKEND"))
  };
}



