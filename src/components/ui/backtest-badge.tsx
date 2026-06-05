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
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className={`flex items-center gap-1.5 px-2.5 py-1 ${isProfitable ? 'border-stock-up/30 bg-stock-up/10 text-stock-up' : 'border-stock-down/30 bg-stock-down/10 text-stock-down'}`}>
          <Target className="w-3.5 h-3.5" />
          <span>AI 추천: {data.best_strategy_name}</span>
        </Badge>
        <Badge variant="secondary" className="flex items-center gap-1.5 px-2 py-1 bg-secondary/40 border border-border/50 text-xs font-normal">
          <Activity className="w-3.5 h-3.5 text-primary" />
          승률 <span className="font-bold text-foreground">{data.win_rate}%</span>
        </Badge>
        <Badge variant="secondary" className="flex items-center gap-1.5 px-2 py-1 bg-secondary/40 border border-border/50 text-xs font-normal">
          {isProfitable ? <TrendingUp className="w-3.5 h-3.5 text-stock-up" /> : <TrendingDown className="w-3.5 h-3.5 text-stock-down" />}
          누적수익 <span className={`font-bold ${isProfitable ? 'text-stock-up' : 'text-stock-down'}`}>{data.total_return}%</span>
        </Badge>
      </div>
      <div className="text-[10px] text-muted-foreground/70 ml-1">
        * 과거 1년 백테스트 결과 (MDD: {data.mdd}%)
      </div>
    </div>
  );
}
