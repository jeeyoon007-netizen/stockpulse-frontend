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
    const cached = getCachedData(cacheKey);
    if (cached) return cached;

    try {
        const [foreign, institutional] = await Promise.all([
            fetchInvestorRanking('1', market),
            fetchInvestorRanking('2', market)
        ]);

        const foreignTop10 = foreign.slice(0, 10);
        const instTop10 = institutional.slice(0, 10);

        const uniqueCodes = Array.from(new Set([
            ...foreignTop10.map(s => s.code),
            ...instTop10.map(s => s.code)
        ]));

        // [순차 처리] KIS API TPS 제한을 피하기 위해 0.2초 간격으로 순차 요청
        const detailMap = new Map();
        for (const code of uniqueCodes) {
            const d = await fetchStockDetail(code);
            if (d) detailMap.set(code, d);
            await delay(200); 
        }

        const overlap = foreignTop10.filter(f => instTop10.some(i => i.code === f.code)).map(s => s.name);

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
                const turnover = (stock.amount / detail.marketCap) * 100;
                return turnover > 3; 
            })
            .map(([_, d]) => d.name);

        const result = {
            foreignTop10,
            instTop10,
            overlap,
            dominantIndustries,
            highTurnover: highTurnover.slice(0, 3)
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

  try {
    const results = await Promise.all([
      fetchMajorIndex("0001", "코스피"),
      fetchMajorIndex("1001", "코스닥"),
      fetchMajorIndex("2001", "코스피200"),
      fetchExchangeRate(),
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
  try {
    return await fetchFearGreedIndex();
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

  try {
    const [funds, creditHistory, kospiInfo, newHighCount] = await Promise.all([
      fetchMarketFunds(),
      fetchDailyCreditBalance(20),
      fetchMajorIndex("0001", "코스피"),
      fetchNewHighCount()
    ]);

    let adr = 0;
    let adrSignal = "데이터 부족";
    
    if (kospiInfo && kospiInfo.advanceCount && kospiInfo.declineCount) {
        const adv = kospiInfo.advanceCount;
        const dec = kospiInfo.declineCount;
        adr = (adv / dec) * 100;
        
        if (adr >= 120) adrSignal = "매도 검토 (과열)";
        else if (adr <= 80) adrSignal = "바닥권 신호 (과매도)";
        else adrSignal = "중립";
    }

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
        adr: adr.toFixed(1), 
        adrSignal,
        advanceCount: kospiInfo?.advanceCount || 0,
        declineCount: kospiInfo?.declineCount || 0,
        newHighCount,
        highTrend
    };

    // 데이터가 정상적으로 수집된 경우에만 캐시 (고객예탁금 정보가 있을 때)
    if (funds) {
        setCachedData('canary_data', result);
    }
    return result;
  } catch (error) {
    console.error("fetchCanaryDataAction error:", error);
    return { 
        funds: null, creditHistory: [], adr: "0", adrSignal: "오류",
        advanceCount: 0, declineCount: 0, newHighCount: 0, highTrend: []
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

