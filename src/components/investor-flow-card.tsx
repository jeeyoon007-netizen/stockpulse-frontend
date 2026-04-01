import React, { useState, useEffect } from "react";
import { type InvestorFlowData } from "@/lib/api/kis-market";
import { fetchInvestorFlowAnalysisAction } from "@/app/actions";
import { Users, Building, TrendingUp, TrendingDown, Minus, Zap, Target, Search, Activity } from "lucide-react";

export function InvestorFlowCard() {
  const [market, setMarket] = useState<'0001' | '1001'>('0001'); // 0001: KOSPI, 1001: KOSDAQ
  const [analysis, setAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const res = await fetchInvestorFlowAnalysisAction(market);
      setAnalysis(res);
      setLoading(false);
    }
    load();
  }, [market]);

  const formatAmount = (a: number) => {
    if (a >= 1000) return (a / 1000).toFixed(1) + "0억";
    return a.toLocaleString() + "억";
  };

  const StockList = ({ title, data, icon: Icon, color }: { title: string, data: InvestorFlowData[], icon: any, color: string }) => (
    <div className="flex-1 flex flex-col min-w-0">
        <div className={`flex items-center gap-2 mb-2 px-1 py-1 rounded border-l-2 bg-gradient-to-r from-muted/50 to-transparent ${color.replace('text-', 'border-')}`}>
            <Icon className={`w-3 h-3 ${color}`} />
            <span className="text-[10px] font-black uppercase tracking-tight">{title} Top 10</span>
        </div>
        <div className="space-y-0.5">
            {data.map((item, idx) => (
                <div key={item.code} className="flex justify-between items-center py-1.5 px-2 hover:bg-muted/30 rounded transition-colors group cursor-default">
                    <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[9px] text-muted-foreground font-mono w-3">{idx + 1}</span>
                        <span className="text-[10.5px] font-bold truncate max-w-[80px] group-hover:text-primary transition-colors">{item.name}</span>
                    </div>
                    <div className="flex flex-col items-end">
                        <span className={`text-[10px] font-black ${color}`}>{formatAmount(item.amount)}</span>
                    </div>
                </div>
            ))}
        </div>
    </div>
  );

  return (
    <div className="flex flex-col p-4 bg-background/40 rounded-xl border border-border/50 h-full overflow-hidden hover:border-chart-2/30 transition-all group">
      <div className="flex justify-between items-center mb-5">
        <h3 className="text-sm font-bold text-muted-foreground flex items-center gap-2 tracking-tight">
            <Users className="w-4 h-4 text-chart-2" />
            수급 입체 분석 (Top 10)
        </h3>
        <div className="flex bg-muted/40 p-0.5 rounded-md text-[9px] font-black border border-border/50">
            <button 
                onClick={() => setMarket('0001')}
                className={`px-3 py-1 rounded transition-all ${market === '0001' ? 'bg-background text-primary shadow-[0_1px_3px_rgba(0,0,0,0.2)]' : 'text-muted-foreground hover:text-foreground'}`}
            >KOSPI</button>
            <button 
                onClick={() => setMarket('1001')}
                className={`px-3 py-1 rounded transition-all ${market === '1001' ? 'bg-background text-primary shadow-[0_1px_3px_rgba(0,0,0,0.2)]' : 'text-muted-foreground hover:text-foreground'}`}
            >KOSDAQ</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide space-y-6">
        {loading ? (
            <div className="grid grid-cols-2 gap-4 mt-2">
                <div className="space-y-2">
                    {[...Array(6)].map((_, i) => <div key={i} className="h-8 bg-muted/10 animate-pulse rounded-md" />)}
                </div>
                <div className="space-y-2">
                    {[...Array(6)].map((_, i) => <div key={i} className="h-8 bg-muted/10 animate-pulse rounded-md" />)}
                </div>
            </div>
        ) : analysis ? (
            <div className="space-y-6">
                {/* Lists side-by-side */}
                <div className="flex gap-4">
                    <StockList title="외국인" data={analysis.foreignTop10} icon={Users} color="text-chart-2" />
                    <StockList title="기관" data={analysis.instTop10} icon={Building} color="text-chart-4" />
                </div>

                {/* Supply & Demand Features (수급 특징) */}
                <div className="bg-background/60 rounded-xl border border-border/60 p-4 space-y-4 shadow-sm">
                    <div className="flex items-center gap-2 pb-2 border-b border-border/30">
                        <Zap className="w-4 h-4 text-primary" />
                        <span className="text-[11px] font-black uppercase tracking-widest text-primary">수급 핵심 특징주 (INSIGHT)</span>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                        {/* Overlap */}
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground mb-1">
                                <Target className="w-3 h-3 text-stock-up" />
                                <span>양매수 동시 포착 종목</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5 ">
                                {analysis.overlap.length > 0 ? analysis.overlap.map((name: string) => (
                                    <span key={name} className="px-2 py-0.5 bg-stock-up/10 text-stock-up text-[10px] font-bold rounded-full border border-stock-up/20 animate-pulse">{name}</span>
                                )) : <span className="text-[10px] text-muted-foreground italic">포착된 종목 없음</span>}
                            </div>
                        </div>

                        {/* Dominant Industry */}
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground mb-1">
                                <Search className="w-3 h-3 text-primary" />
                                <span>주도 산업군 (섹터)</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {analysis.dominantIndustries.map((name: string) => (
                                    <span key={name} className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-bold rounded-full border border-primary/20">{name}</span>
                                ))}
                            </div>
                        </div>

                        {/* High Turnover */}
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground mb-1">
                                <Activity className="w-3 h-3 text-secondary" />
                                <span>시총 대비 수급 집중주</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {analysis.highTurnover.length > 0 ? analysis.highTurnover.map((name: string) => (
                                    <span key={name} className="px-2 py-0.5 bg-secondary/10 text-secondary text-[10px] font-bold rounded-full border border-secondary/20">{name}</span>
                                )) : <span className="text-[10px] text-muted-foreground italic">데이터 분석 중</span>}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground opacity-30 py-10">
                <Minus className="w-8 h-8 mb-2" />
                <span className="text-[10px]">분석 실패</span>
            </div>
        )}
      </div>
    </div>
  );
}
