import "server-only";

export interface FearGreedIndicator {
  name: string;
  value: number;
  raw?: number;
  unit?: string;
  barMax?: number;
}

export interface FearGreedMarketData {
  score: number;
  label: string;
  indicators: FearGreedIndicator[];
  previous_close?: number;
  previous_1_week?: number;
  kospi_price?: string;
  kospi_change?: string;
  kosdaq_change?: string;
  vkospi?: string;
}

export interface FearGreedHistory {
  date: string;
  us: number;
  kr: number;
}

export interface FearGreedResponse {
  success: boolean;
  timestamp: string;
  us: FearGreedMarketData;
  kr: FearGreedMarketData;
  history: FearGreedHistory[];
}

/**
 * 한국/미국 공포탐욕지수 데이터를 가져옵니다.
 * 데이터 출처: feargreed.co.kr (Vercel API)
 */
export async function fetchFearGreedIndex(): Promise<FearGreedResponse> {
  const url = "https://feargree-api.vercel.app/api";
  
  try {
    const res = await fetch(url, {
      next: { revalidate: 3600 }, // 1시간마다 캐시 갱신
    });

    if (!res.ok) {
      throw new Error(`Fear & Greed API 호출 실패: ${res.status}`);
    }

    const data = await res.json();
    return data as FearGreedResponse;
  } catch (error) {
    console.error("fetchFearGreedIndex error:", error);
    // 에러 발생 시 기본값 반환 혹은 던지기
    throw error;
  }
}
