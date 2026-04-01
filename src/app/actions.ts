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

    // null 필터링 (에러 시 더미 혹은 빈 값 방어)
    return results.filter((r): r is IndexPriceData => r !== null);
  } catch (error) {
    console.error("fetchMarketOverviewAction error:", error);
    return [];
  }
}

export async function analyzeStockAction(code: string): Promise<StockAnalysisResponse> {
  try {
    const stockData = await fetchStockOHLCV(code, 240);
    const result = runAnalysisEngine(stockData.ohlcv);

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
 * [카나리아] 시장 자금 및 신용잔고 서버 액션
 */
export async function fetchCanaryDataAction() {
  try {
    const [funds, creditHistory] = await Promise.all([
      fetchMarketFunds(),
      fetchDailyCreditBalance(20)
    ]);
    return { funds, creditHistory };
  } catch (error) {
    console.error("fetchCanaryDataAction error:", error);
    return { funds: null, creditHistory: [] };
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

