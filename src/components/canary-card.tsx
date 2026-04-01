"use client";

import React from "react";
import { type MarketFundsData, type CreditBalanceData } from "@/lib/api/kis-market";
import { TrendingUp, TrendingDown, Minus, Wallet, CreditCard } from "lucide-react";

interface Props {
  data: {
    funds: MarketFundsData | null;
    creditHistory: CreditBalanceData[];
  };
}

export function CanaryCard({ data }: Props) {
  const { funds, creditHistory } = data;
  
  // Format Large Money (KRW 억/조)
  const formatMoney = (val: number) => {
    if (val >= 100000000) { // 1억 이상 (억 단위로 옴?)
        // KIS mktfunds는 보통 '억원' 단위인 경우가 많으나, 소스마다 다름. 
        // 1조 = 10,000억.
        const jo = Math.floor(val / 10000);
        const eok = val % 10000;
        if (jo > 0) return `${jo}조 ${eok}억`;
        return `${eok}억`;
    }
    return val.toLocaleString();
  };

  const getTrendIcon = (curr: number, prev: number) => {
    if (curr > prev) return <TrendingUp className="w-3 h-3 text-stock-up" />;
    if (curr < prev) return <TrendingDown className="w-3 h-3 text-stock-down" />;
    return <Minus className="w-3 h-3 text-stock-flat" />;
  };

  const latestCredit = creditHistory[creditHistory.length - 1];
  const prevCredit = creditHistory[creditHistory.length - 2];

  return (
    <div className="flex flex-col p-4 bg-background/40 rounded-xl border border-border/50 h-full hover:border-chart-3/30 transition-all">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-chart-3 animate-pulse"></span>
            카나리아 (시장 자금)
        </h3>
        <span className="text-[10px] text-muted-foreground font-mono">
            {funds?.date || latestCredit?.date}
        </span>
      </div>

      <div className="space-y-6">
        {/* Deposit */}
        <div className="p-3 bg-muted/20 rounded-lg relative overflow-hidden group">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 bg-chart-1/10 rounded-md">
                <Wallet className="w-4 h-4 text-chart-1" />
            </div>
            <span className="text-xs text-muted-foreground">고객예탁금</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black tracking-tighter">
                {funds ? formatMoney(funds.deposit) : "---"}
            </span>
            <span className="text-[10px] font-bold text-muted-foreground">원</span>
          </div>
          <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
            <TrendingUp className="w-12 h-12 rotate-[15deg]" />
          </div>
        </div>

        {/* Credit Balance */}
        <div className="p-3 bg-muted/20 rounded-lg relative overflow-hidden group">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 bg-chart-5/10 rounded-md">
                <CreditCard className="w-4 h-4 text-chart-5" />
            </div>
            <span className="text-xs text-muted-foreground">신용잔고 추이</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black tracking-tighter">
                {latestCredit ? (latestCredit.amount / 10000).toFixed(1) : "---"}
            </span>
            <span className="text-[10px] font-bold text-muted-foreground">조 원</span>
            {latestCredit && prevCredit && (
              <div className="flex items-center gap-1 ml-auto">
                {getTrendIcon(latestCredit.amount, prevCredit.amount)}
                <span className={`text-[10px] font-bold ${latestCredit.amount >= prevCredit.amount ? 'text-stock-up' : 'text-stock-down'}`}>
                    {latestCredit.ratio}%
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Mini Chart Area (Placeholder for trend view) */}
        <div className="flex items-end justify-between gap-1 h-12 px-1">
            {creditHistory.slice(-10).map((h, i) => {
                const max = Math.max(...creditHistory.map(x => x.amount));
                const min = Math.min(...creditHistory.map(x => x.amount));
                const height = ((h.amount - min) / (max - min || 1)) * 100;
                return (
                    <div 
                        key={i} 
                        className="bg-chart-3/30 w-full rounded-t-[2px] hover:bg-chart-3 transition-all" 
                        style={{ height: `${Math.max(10, height)}%` }}
                        title={`${h.date}: ${h.amount}`}
                    ></div>
                );
            })}
        </div>
      </div>
    </div>
  );
}
