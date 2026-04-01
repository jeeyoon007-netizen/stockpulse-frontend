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
  type MarketFundsData, 
  type CreditBalanceData, 
  type InvestorFlowData,
  type IndexPriceData
} from "@/lib/api/kis-market";

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
 * [카나리아] 시장 자금, 신용잔고 및 ADR 서버 액션
 */
export async function fetchCanaryDataAction() {
  try {
    const [funds, creditHistory, kospiInfo] = await Promise.all([
      fetchMarketFunds(),
      fetchDailyCreditBalance(20),
      fetchMajorIndex("0001", "코스피")
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

    return { 
        funds, 
        creditHistory, 
        adr: adr.toFixed(1), 
        adrSignal,
        advanceCount: kospiInfo?.advanceCount || 0,
        declineCount: kospiInfo?.declineCount || 0
    };
  } catch (error) {
    console.error("fetchCanaryDataAction error:", error);
    return { 
        funds: null, 
        creditHistory: [], 
        adr: "0", 
        adrSignal: "오류",
        advanceCount: 0,
        declineCount: 0
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

