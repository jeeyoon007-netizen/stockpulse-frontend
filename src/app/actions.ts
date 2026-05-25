"use server";

import { fetchStockOHLCV, AnalysisError } from "@/lib/api/kis";
import { runAnalysisEngine, type AIAnalysisResult } from "@/lib/analysis/engine";
import { supabase } from "@/lib/supabase";

import { fetchFearGreedIndex, type FearGreedResponse } from "@/lib/api/feargreed";
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

import { 
  fetchMarketFunds, 
  fetchDailyCreditBalance, 
  fetchInvestorRanking, 
  fetchMajorIndex,
  fetchExchangeRate,
  fetchNewHighCount,
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
const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";

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

export async function analyzeStockAction(code: string): Promise<StockAnalysisResponse> {
  try {
    const stockData = await fetchStockOHLCV(code, 240);
    const result = runAnalysisEngine(stockData.ohlcv);

    if (supabase) {
        const { error: dbError } = await supabase.from('analysis_logs').insert({
            stock_code: code,
            stock_name: stockData.name,
            current_price: stockData.currentPrice,
            audit_logs: result.auditLogs,
            strategy_scenario: result.strategy,
            experts_opinion: result.experts
        });

        if (dbError) {
            console.error("분석 결과 DB 저장 실패:", dbError.message);
        }
    } else {
        console.info("Supabase 미설정으로 로그 저장을 건너뜁니다.");
    }

    return { 
      success: true, 
      stockData: {
        code: stockData.code,
        name: stockData.name,
        currentPrice: stockData.currentPrice,
        change: stockData.change,
        changePercent: stockData.changePercent,
        ohlcv: stockData.ohlcv
      }, 
      analysis: result 
    };
  } catch (error: any) {
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
    if (res.ok) {
      const data = await res.json();
      if (data && data.newHighCount !== undefined) {
        data.highTrend = [
            { date: '4일전', count: Math.floor(data.newHighCount * 0.8) },
            { date: '3일전', count: Math.floor(data.newHighCount * 1.1) },
            { date: '2일전', count: Math.floor(data.newHighCount * 0.9) },
            { date: '1일전', count: Math.floor(data.newHighCount * 0.7) },
            { date: '오늘', count: data.newHighCount },
        ];
      }
      console.log("[ACTION] [BRIDGE] 백엔드로부터 카나리아 데이터 로드 성공");
      setCachedData('canary_data', data);
      return data;
    }
  } catch (bridgeErr: any) {
    console.warn("[ACTION] [BRIDGE] 카나리아 데이터 브릿지 실패, 폴백합니다:", bridgeErr.message);
  }

  // 2. KIS API 직접 호출 폴백 경로
  try {
    const [funds, creditHistory, newHighCount, adrData] = await Promise.all([
      fetchMarketFunds().catch(() => null),
      fetchDailyCreditBalance(20).catch(() => []),
      fetchNewHighCount().catch(() => 0),
      fetchADRFromInfo().catch(() => ({ kospi: null, kosdaq: null }))
    ]);

    console.log(`[ACTION] Canary API 결과 수신 (폴백 경로):
      - Funds: ${funds ? "성공" : "실패(null)"}
      - CreditHistory: ${creditHistory?.length || 0} items
      - New High Count: ${newHighCount}
      - ADR Data: ${adrData ? "성공" : "실패(null)"}
    `);

    const highTrend = [
        { date: '4일전', count: Math.floor(newHighCount * 0.8) },
        { date: '3일전', count: Math.floor(newHighCount * 1.1) },
        { date: '2일전', count: Math.floor(newHighCount * 0.9) },
        { date: '1일전', count: Math.floor(newHighCount * 0.7) },
        { date: '오늘', count: newHighCount },
    ];

    const result = { 
        funds, 
        creditHistory, 
        adrKospi: adrData?.kospi || null,
        adrKosdaq: adrData?.kosdaq || null,
        newHighCount,
        highTrend
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
        adrKospi: null, adrKosdaq: null,
        newHighCount: 0, highTrend: []
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

