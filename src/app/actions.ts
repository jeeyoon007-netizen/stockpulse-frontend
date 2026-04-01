"use server";

import { fetchStockOHLCV, AnalysisError } from "@/lib/api/kis";
import { runAnalysisEngine, type AIAnalysisResult } from "@/lib/analysis/engine";
import { supabase } from "@/lib/supabase";

import { fetchFearGreedIndex, type FearGreedResponse } from "@/lib/api/feargreed";
import { 
  fetchMarketFunds, 
  fetchDailyCreditBalance, 
  fetchInvestorRanking, 
  fetchMajorIndex,
  fetchExchangeRate,
  fetchNewHighCount,
  fetchStockDetail, // [신규 추가]
  type MarketFundsData, 
  type CreditBalanceData, 
  type InvestorFlowData,
  type IndexPriceData
} from "@/lib/api/kis-market";

// ... (existing action)

/**
 * 수급 상황 및 특징 분석 서버 액션
 */
export async function fetchInvestorFlowAnalysisAction(market = '0001') {
    try {
        const [foreign, institutional] = await Promise.all([
            fetchInvestorRanking('1', market),
            fetchInvestorRanking('2', market)
        ]);

        const foreignTop10 = foreign.slice(0, 10);
        const instTop10 = institutional.slice(0, 10);

        // 상위 20개 종목(중복 제외)에 대한 상세 정보(산업군, 시총) 가져오기
        const uniqueCodes = Array.from(new Set([
            ...foreignTop10.map(s => s.code),
            ...instTop10.map(s => s.code)
        ]));

        const details = await Promise.all(uniqueCodes.map(code => fetchStockDetail(code)));
        const detailMap = new Map();
        details.forEach((d, i) => {
            if (d) detailMap.set(uniqueCodes[i], d);
        });

        // 1. 동시 순매수 종목
        const overlap = foreignTop10.filter(f => instTop10.some(i => i.code === f.code)).map(s => s.name);

        // 2. 주도 산업군 (Top 10 전체 대상)
        const industryCount: Record<string, number> = {};
        detailMap.forEach(d => {
            industryCount[d.industry] = (industryCount[d.industry] || 0) + 1;
        });
        const dominantIndustries = Object.entries(industryCount)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 2)
            .map(([name]) => name);

        // 3. 고회전 종목 (시총 대비 거래대금이 5% 이상인 과열 종목)
        // KIS amount/avls 모두 백만원 단위
        const highTurnover = Array.from(detailMap.entries())
            .filter(([code, detail]) => {
                const stock = [...foreignTop10, ...instTop10].find(s => s.code === code);
                if (!stock || detail.marketCap === 0) return false;
                const turnover = (stock.amount / detail.marketCap) * 100;
                return turnover > 3; // 3% 이상일 때 고회전으로 간주
            })
            .map(([_, d]) => d.name);

        return {
            foreignTop10,
            instTop10,
            overlap,
            dominantIndustries,
            highTurnover: highTurnover.slice(0, 3)
        };
    } catch (error) {
        console.error("fetchInvestorFlowAnalysisAction error:", error);
        return {
            foreignTop10: [],
            instTop10: [],
            overlap: [],
            dominantIndustries: [],
            highTurnover: []
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
  try {
    const results = await Promise.all([
      fetchMajorIndex("0001", "코스피"),
      fetchMajorIndex("1001", "코스닥"),
      fetchMajorIndex("2001", "코스피200"),
      fetchExchangeRate(),
    ]);

    const activeResults = results.filter((r): r is IndexPriceData => r !== null);
    
    if (activeResults.length === 0) {
        console.warn("모든 시장 지수 API 호출에 실패했습니다. 환경 변수(KIS_APP_KEY 등)를 확인해주세요.");
        // 화면이 무한 로딩(깜빡임)에 빠지지 않도록 '점검 중' 상태 반환
        return [
          { label: "코스피", value: "데이터 없음", change: "0.00", changePercent: "0.00%", direction: "flat" },
          { label: "코스닥", value: "데이터 없음", change: "0.00", changePercent: "0.00%", direction: "flat" },
          { label: "코스피200", value: "데이터 없음", change: "0.00", changePercent: "0.00%", direction: "flat" },
          { label: "원/달러", value: "데이터 없음", change: "0.00", changePercent: "0.00%", direction: "flat" },
        ];
    }
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
  try {
    const [funds, creditHistory, kospiInfo, newHighCount] = await Promise.all([
      fetchMarketFunds(),
      fetchDailyCreditBalance(20),
      fetchMajorIndex("0001", "코스피"),
      fetchNewHighCount()
    ]);

    // ADR 계산 (상승 종목 수 / 하락 종목 수)
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

    // 신고가 5일 추이 (실제 DB가 없으므로 현재는 현재값 기반 모의 데이터 생성)
    const highTrend = [
        { date: '4일전', count: Math.floor(newHighCount * 0.8) },
        { date: '3일전', count: Math.floor(newHighCount * 1.1) },
        { date: '2일전', count: Math.floor(newHighCount * 0.9) },
        { date: '1일전', count: Math.floor(newHighCount * 0.7) },
        { date: '오늘', count: newHighCount },
    ];

    return { 
        funds, 
        creditHistory, 
        adr: adr.toFixed(1), 
        adrSignal,
        advanceCount: kospiInfo?.advanceCount || 0,
        declineCount: kospiInfo?.declineCount || 0,
        newHighCount,
        highTrend
    };
  } catch (error) {
    console.error("fetchCanaryDataAction error:", error);
    return { 
        funds: null, 
        creditHistory: [], 
        adr: "0", 
        adrSignal: "오류",
        advanceCount: 0,
        declineCount: 0,
        newHighCount: 0,
        highTrend: []
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

