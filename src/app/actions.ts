"use server";

import { fetchStockOHLCV, AnalysisError } from "@/lib/api/kis";
import { runAnalysisEngine, type AIAnalysisResult } from "@/lib/analysis/engine";
import { supabase } from "@/lib/supabase";

export interface StockAnalysisResponse {
  success: boolean;
  stockData?: any; // KIS Data
  analysis?: AIAnalysisResult;
  error?: string;
}

export async function analyzeStockAction(code: string): Promise<StockAnalysisResponse> {
  try {
    // [Step 1] KIS API 연동 및 무결성 검증 (240일 기준 수집)
    const stockData = await fetchStockOHLCV(code, 240);

    // [Step 2, 3, 4] 지표 계산, 3인 전문가 논의 및 Audit Log, 시나리오 생성
    const result = runAnalysisEngine(stockData.ohlcv);

    // [Step 5] Supabase DB 저장
    const { error } = await supabase.from('analysis_logs').insert({
        stock_code: code,
        stock_name: stockData.name,
        current_price: stockData.currentPrice,
        audit_logs: result.auditLogs,
        strategy_scenario: result.strategy,
        experts_opinion: result.experts
    });

    if (error) {
        console.error("분석 결과 DB 저장 실패:", error.message);
        // 저장이 실패해도 분석 결과는 유저에게 반환
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
    if (error instanceof AnalysisError) {
        return { success: false, error: error.message };
    }
    return { success: false, error: error.message || "알 수 없는 에러가 발생했습니다." };
  }
}
