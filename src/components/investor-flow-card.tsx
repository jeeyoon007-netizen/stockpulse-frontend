"use client";

import React, { useState, useEffect } from "react";
import { type InvestorFlowData } from "@/lib/api/kis-market";
import { fetchInvestorFlowAction } from "@/app/actions";
import { Users, Building, TrendingUp, TrendingDown, Minus } from "lucide-react";

export function InvestorFlowCard() {
  const [activeTab, setActiveTab] = useState<'1' | '2'>('1'); // 1: Foreign, 2: Inst
  const [market, setMarket] = useState<'0001' | '1001'>('0001'); // 0001: KOSPI, 1001: KOSDAQ
  const [data, setData] = useState<InvestorFlowData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const res = await fetchInvestorFlowAction(activeTab, market);
      setData(res);
      setLoading(false);
    }
    load();
  }, [activeTab, market]);

  const formatPrice = (p: number) => p.toLocaleString() + "원";
  const formatAmount = (a: number) => {
    // KIS FHPTJ04400000는 백만원 단위인 경우가 많음 
    if (a >= 1000) {
        return (a / 1000).toFixed(1) + "0억";
    }
    return a.toLocaleString() + "억";
  };

  return (
    <div className="flex flex-col p-4 bg-background/40 rounded-xl border border-border/50 h-full overflow-hidden hover:border-chart-2/30 transition-all group">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Users className="w-4 h-4 text-chart-2" />
            수급 상황 (순매수 상위)
        </h3>
        <div className="flex bg-muted/30 p-0.5 rounded-md text-[10px] font-bold">
            <button 
                onClick={() => setMarket('0001')}
                className={`px-2 py-0.5 rounded ${market === '0001' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'}`}
            >KOSPI</button>
            <button 
                onClick={() => setMarket('1001')}
                className={`px-2 py-0.5 rounded ${market === '1001' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'}`}
            >KOSDAQ</button>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <button 
            onClick={() => setActiveTab('1')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === '1' ? 'bg-chart-2/10 text-chart-2 border border-chart-2/20' : 'bg-muted/10 text-muted-foreground hover:bg-muted/20 border border-transparent'}`}
        >
            <Users className="w-3 h-3" /> 외국인
        </button>
        <button 
            onClick={() => setActiveTab('2')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === '2' ? 'bg-chart-4/10 text-chart-4 border border-chart-4/20' : 'bg-muted/10 text-muted-foreground hover:bg-muted/20 border border-transparent'}`}
        >
            <Building className="w-3 h-3" /> 기관
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {loading ? (
            <div className="flex flex-col gap-2 mt-2">
                {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-10 bg-muted/10 animate-pulse rounded-md"></div>
                ))}
            </div>
        ) : data.length > 0 ? (
            <div className="space-y-1">
                {data.map((item, idx) => (
                    <div key={item.code} className="grid grid-cols-[20px_1fr_80px] items-center py-2 px-2 hover:bg-muted/20 rounded-md transition-colors cursor-pointer text-[11px]">
                        <span className="text-muted-foreground font-mono font-black">{idx + 1}</span>
                        <div className="flex flex-col ml-1">
                            <span className="font-bold truncate max-w-[100px]">{item.name}</span>
                            <span className="text-[9px] text-muted-foreground font-mono">{item.code}</span>
                        </div>
                        <div className="flex flex-col items-end">
                            <span className="font-mono font-black text-chart-2">{formatAmount(item.amount)}</span>
                            <div className="flex items-center gap-1">
                                {item.change > 0 ? <TrendingUp className="w-2 h-2 text-stock-up" /> : <TrendingDown className="w-2 h-2 text-stock-down" />}
                                <span className={`text-[9px] font-bold ${item.change > 0 ? 'text-stock-up' : 'text-stock-down'}`}>
                                    {item.changePercent}%
                                </span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground opacity-30 py-10">
                <Minus className="w-8 h-8 mb-2" />
                <span className="text-[10px]">데이터가 없습니다.</span>
            </div>
        )}
      </div>
    </div>
  );
}
