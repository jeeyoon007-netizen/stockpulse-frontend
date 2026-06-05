"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Target, TrendingUp, TrendingDown, Activity } from "lucide-react";

interface BacktestBadgeProps {
  stockCode: string;
}

export function BacktestBadge({ stockCode }: BacktestBadgeProps) {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchBacktest() {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || "https://stock-brv7.onrender.com"}/api/v1/analysis/backtest?code=${stockCode}`);
        const json = await res.json();
        if (json.success && json.data) {
          setData(json.data);
        }
      } catch (e) {
        console.error("Failed to fetch backtest data", e);
      } finally {
        setIsLoading(false);
      }
    }
    fetchBacktest();
  }, [stockCode]);

  if (isLoading) return <Badge variant="outline" className="animate-pulse bg-secondary/50 text-transparent">Loading...</Badge>;
  if (!data) return null;

  const isProfitable = data.total_return > 0;

  return (
    <div className="flex flex-col gap-2 w-full mt-1">
      {/* 베스트 전략 요약 뱃지 */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className={`flex items-center gap-1.5 px-2.5 py-1 ${isProfitable ? 'border-stock-up/30 bg-stock-up/10 text-stock-up' : 'border-stock-down/30 bg-stock-down/10 text-stock-down'}`}>
          <Target className="w-3.5 h-3.5" />
          <span>AI 추천: {data.best_strategy_name}</span>
        </Badge>
        <span className="text-[10px] text-muted-foreground/70 ml-1">
          * 과거 1년 백테스트 결과
        </span>
      </div>

      {/* 3가지 모드 비교 카드 목록 */}
      {data.all_strategies && data.all_strategies.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full max-w-[700px] mt-1">
          {data.all_strategies.map((st: any, idx: number) => {
            const isBest = st.strategy_name === data.best_strategy_name;
            const modeMap: any = { "AI 분석 (단타)": "단타 모드", "AI 분석 (스윙)": "스윙 모드", "AI 분석 (장기투자)": "장기 모드" };
            const label = modeMap[st.strategy_name] || st.strategy_name;
            return (
              <div key={idx} className={`flex flex-col p-2.5 rounded-lg border transition-all ${isBest ? 'bg-primary/5 border-primary/30 shadow-sm' : 'bg-background/40 border-border/50'}`}>
                <div className="flex justify-between items-center mb-1">
                  <span className={`text-[11px] font-bold ${isBest ? 'text-primary' : 'text-muted-foreground'}`}>
                    {label} {isBest && <span className="text-[9px] bg-primary/20 text-primary px-1 py-0.5 rounded ml-1">최적</span>}
                  </span>
                  <span className={`font-mono text-xs font-black ${st.total_return > 0 ? 'text-stock-up' : 'text-stock-down'}`}>
                    {st.total_return > 0 ? '+' : ''}{st.total_return}%
                  </span>
                </div>
                <div className="flex justify-between items-center text-[10px] text-muted-foreground font-medium">
                  <span>승률: <span className="font-mono">{st.win_rate}%</span></span>
                  <span>최대 낙폭: <span className="font-mono">{st.mdd}%</span></span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        // fallback if all_strategies is not populated yet
        <div className="flex flex-wrap items-center gap-2 mt-0.5">
          <Badge variant="secondary" className="flex items-center gap-1.5 px-2 py-1 bg-secondary/40 border border-border/50 text-xs font-normal">
            <Activity className="w-3.5 h-3.5 text-primary" />
            승률 <span className="font-bold text-foreground">{data.win_rate}%</span>
          </Badge>
          <Badge variant="secondary" className="flex items-center gap-1.5 px-2 py-1 bg-secondary/40 border border-border/50 text-xs font-normal">
            {isProfitable ? <TrendingUp className="w-3.5 h-3.5 text-stock-up" /> : <TrendingDown className="w-3.5 h-3.5 text-stock-down" />}
            누적수익 <span className={`font-bold ${isProfitable ? 'text-stock-up' : 'text-stock-down'}`}>{data.total_return}%</span>
          </Badge>
          <div className="text-[10px] text-muted-foreground/70 ml-1">
            (최대 낙폭: {data.mdd}%)
          </div>
        </div>
      )}
    </div>
  );
}
