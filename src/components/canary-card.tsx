"use client";

import React from "react";
import { type MarketFundsData, type CreditBalanceData } from "@/lib/api/kis-market";
import { TrendingUp, TrendingDown, Minus, Wallet, CreditCard, Activity } from "lucide-react";

interface Props {
  data: {
    funds: MarketFundsData | null;
    creditHistory: CreditBalanceData[];
    adrKospi: {
      adr: string;
      time: string;
      signal: string;
    } | null;
    adrKosdaq: {
      adr: string;
      time: string;
      signal: string;
    } | null;
    newHighCount?: number;
    highTrend?: { date: string, count: number }[];
  };
}

export function CanaryCard({ data }: Props) {
  const { funds, creditHistory, adrKospi, adrKosdaq, newHighCount = 0, highTrend = [] } = data;
  
  // Format Large Money (KRW 억/조)
  const formatMoney = (val: number) => {
    if (val >= 10000) { 
        const jo = Math.floor(val / 10000);
        const eok = val % 10000;
        if (jo > 0) return `${jo}조 ${eok}억`;
        return `${eok}억`;
    }
    return `${val}억`;
  };

  const getTrendIcon = (curr: number, prev: number) => {
    if (curr > prev) return <TrendingUp className="w-3 h-3 text-stock-up" />;
    if (curr < prev) return <TrendingDown className="w-3 h-3 text-stock-down" />;
    return <Minus className="w-3 h-3 text-stock-flat" />;
  };

  const latestCredit = creditHistory[creditHistory.length - 1];
  const prevCredit = creditHistory[creditHistory.length - 2];

  const getSignalColor = (signal: string) => {
    if (signal.includes("매도")) return "text-stock-down";
    if (signal.includes("바닥")) return "text-stock-up";
    return "text-muted-foreground";
  };

  return (
    <div className="flex flex-col p-3 md:p-4 bg-background/40 rounded-xl border border-border/50 h-full hover:border-chart-3/30 transition-all">
      <div className="flex justify-between items-center mb-4 md:mb-6">
        <h3 className="text-xs md:text-sm font-medium text-muted-foreground flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-chart-3 animate-pulse"></span>
            카나리아 (시장 자금 & 심리)
        </h3>
        <span className="text-[10px] text-muted-foreground font-mono">
            {funds?.date || latestCredit?.date}
        </span>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2 md:gap-3">
            {/* Deposit */}
            <div className="p-2.5 md:p-3 bg-muted/20 rounded-lg relative overflow-hidden group">
              <div className="flex items-center gap-3 mb-1">
                <div className="p-2 bg-chart-1/10 rounded-md">
                    <Wallet className="w-4 h-4 text-chart-1" />
                </div>
                <span className="text-[10px] text-muted-foreground">고객예탁금</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-base md:text-lg font-black tracking-tighter">
                    {funds ? formatMoney(funds.deposit) : "---"}
                </span>
                <span className="text-[8px] font-bold text-muted-foreground">원</span>
              </div>
            </div>

            {/* New Highs */}
            <div className="p-2.5 md:p-3 bg-muted/20 rounded-lg relative overflow-hidden group border-l-2 border-stock-up/30">
              <div className="flex items-center gap-3 mb-1">
                <div className="p-2 bg-stock-up/10 rounded-md">
                    <TrendingUp className="w-4 h-4 text-stock-up" />
                </div>
                <span className="text-[10px] text-muted-foreground">52주 신고가</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-base md:text-lg font-black tracking-tighter text-stock-up">
                    {newHighCount}
                </span>
                <span className="text-[8px] font-bold text-muted-foreground">종목</span>
              </div>
            </div>
        </div>

        {/* Credit Balance */}
        <div className="p-2.5 md:p-3 bg-muted/20 rounded-lg relative overflow-hidden group">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 bg-chart-5/10 rounded-md">
                <CreditCard className="w-4 h-4 text-chart-5" />
            </div>
            <span className="text-xs text-muted-foreground">신용잔고 (빚투규모)</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-lg md:text-xl font-black tracking-tighter">
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

        {/* ADR (Advance Decline Ratio) */}
        <div className="p-2.5 md:p-3 bg-muted/20 rounded-lg relative overflow-hidden group">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-chart-2/10 rounded-md">
                <Activity className="w-4 h-4 text-chart-2" />
            </div>
            <span className="text-xs text-muted-foreground">ADR (등락비율)</span>
          </div>
          
          <div className="space-y-3">
            {/* KOSPI ADR */}
            <div className="flex flex-col gap-0.5 border-b border-border/20 pb-2">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-muted-foreground">KOSPI</span>
                <span className="text-[8px] text-muted-foreground font-mono">{adrKospi?.time || "---"}</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-sm md:text-base font-black tracking-tighter">
                  {adrKospi ? Number(adrKospi.adr).toFixed(2) : "---"}%
                </span>
                <span className={`text-[9px] font-bold ${getSignalColor(adrKospi?.signal || "")}`}>
                  {adrKospi?.signal || "---"}
                </span>
              </div>
            </div>

            {/* KOSDAQ ADR */}
            <div className="flex flex-col gap-0.5">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-muted-foreground">KOSDAQ</span>
                <span className="text-[8px] text-muted-foreground font-mono">{adrKosdaq?.time || "---"}</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-sm md:text-base font-black tracking-tighter">
                  {adrKosdaq ? Number(adrKosdaq.adr).toFixed(2) : "---"}%
                </span>
                <span className={`text-[9px] font-bold ${getSignalColor(adrKosdaq?.signal || "")}`}>
                  {adrKosdaq?.signal || "---"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* New High Trend Mini Chart */}
        <div className="pt-2">
            <span className="text-[9px] text-muted-foreground font-bold mb-2 block uppercase tracking-wider">신고가 5일 추이</span>
            <div className="flex items-end justify-between gap-1.5 md:gap-2 h-10 md:h-12 px-1">
                {highTrend.map((h, i) => {
                    const max = Math.max(...highTrend.map(x => x.count), 1);
                    const height = (h.count / max) * 100;
                    return (
                        <div key={i} className="flex flex-col items-center flex-1 gap-1 group">
                            <div 
                                className={`w-full rounded-t-sm transition-all duration-300 ${i === highTrend.length - 1 ? 'bg-stock-up shadow-[0_0_8px_rgba(239,68,68,0.4)]' : 'bg-stock-up/30 group-hover:bg-stock-up/50'}`} 
                                style={{ height: `${Math.max(10, height)}%` }}
                            ></div>
                            <span className="text-[7px] text-muted-foreground font-mono">{h.date}</span>
                        </div>
                    );
                })}
            </div>
        </div>
      </div>
    </div>
  );
}
