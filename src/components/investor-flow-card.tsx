import React, { useState, useEffect } from "react";
import { type InvestorFlowData } from "@/lib/api/kis-market";
import { fetchInvestorFlowAnalysisAction } from "@/app/actions";
import { Users, Building, TrendingUp, TrendingDown, Minus, Zap, Target, Search, Activity, Bot } from "lucide-react";

export function InvestorFlowCard({ onAnalyze }: { onAnalyze?: (code: string, name: string) => void }) {
  const [market, setMarket] = useState<'0001' | '1001'>('0001'); // 0001: KOSPI, 1001: KOSDAQ
  const [analysis, setAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [confirmState, setConfirmState] = useState<{ x: number, y: number, code: string, name: string } | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const res = await fetchInvestorFlowAnalysisAction(market);
      setAnalysis(res);
      setLoading(false);
    }
    load();
  }, [market]);

  const handleStockClick = (e: React.MouseEvent, code: string, name: string) => {
    setConfirmState({ x: e.clientX, y: e.clientY, code, name });
  };

  const formatAmount = (a: number) => {
    if (a === 0) return "-";
    // 억 단위 환산 (1억 = 10^8)
    const inEok = a / 100000000;
    return inEok.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "억";
  };

  const StockList = ({ title, data, icon: Icon, color }: { title: string, data: InvestorFlowData[], icon: any, color: string }) => (
    <div className="flex-1 flex flex-col min-w-0">
        <div className={`flex items-center gap-2 mb-2 px-1.5 py-1.5 rounded border-l-2 bg-gradient-to-r from-muted/50 to-transparent ${color.replace('text-', 'border-')}`}>
            <Icon className={`w-3.5 h-3.5 ${color}`} />
            <span className="text-[11px] md:text-xs font-extrabold uppercase tracking-tight text-foreground">{title} Top 10</span>
        </div>
        <div className="space-y-1">
            {data.map((item, idx) => (
                <div 
                  key={`${item.code}-${idx}`} 
                  className="flex justify-between items-center py-2 px-2.5 hover:bg-yellow-500/10 rounded-md transition-all group cursor-pointer border-l-2 border-transparent hover:border-yellow-500"
                  onClick={(e) => handleStockClick(e, item.code, item.name)}
                >
                    <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-[10px] md:text-[11px] text-muted-foreground/80 font-mono font-bold w-3.5 shrink-0">{idx + 1}</span>
                        <div className="flex flex-col min-w-0">
                            <span className="text-[11.5px] md:text-xs font-extrabold text-foreground truncate max-w-[140px] sm:max-w-[95px] md:max-w-[110px] lg:max-w-none">{item.name}</span>
                            {item.badge && item.badge !== "" && (
                                <span className="text-amber-400 text-[9px] md:text-[10px] font-bold truncate max-w-[160px] sm:max-w-[110px] lg:max-w-none leading-tight mt-0.5" title={item.badge}>
                                    {item.badge}
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="flex flex-col items-end shrink-0">
                        <span className={`text-[11px] md:text-xs font-black ${color}`}>{formatAmount(item.amount)}</span>
                    </div>
                </div>
            ))}
        </div>
    </div>
  );

  return (
    <div className="flex flex-col p-4 bg-background/40 rounded-xl border border-border/50 h-full overflow-hidden hover:border-chart-2/30 transition-all group relative">
      <div className="flex justify-between items-center mb-5">
        <h3 className="text-xs md:text-sm font-extrabold text-foreground tracking-tight flex items-center gap-2">
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
                {/* Lists side-by-side on desktop, stacked on mobile */}
                <div className="flex flex-col sm:flex-row gap-4">
                    <StockList title="외국인" data={analysis.foreignTop10} icon={Users} color="text-chart-2" />
                    <StockList title="기관" data={analysis.instTop10} icon={Building} color="text-chart-4" />
                </div>

                {/* Supply & Demand Features (수급 특징) */}
                <div className="bg-background/60 rounded-xl border border-border/60 p-4 space-y-4 shadow-sm">
                    <div className="flex items-center gap-2 pb-2.5 border-b border-border/30">
                        <Zap className="w-4 h-4 text-primary" />
                        <span className="text-xs md:text-sm font-extrabold tracking-tight text-primary">수급 핵심 특징주 (INSIGHT)</span>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        {/* Overlap */}
                        <div className="flex flex-col gap-1.5">
                            <div className="flex items-center gap-2 text-[11px] md:text-xs font-extrabold text-foreground/95 mb-1">
                                <Target className="w-3.5 h-3.5 text-stock-up" />
                                <span>양매수 동시 포착 종목</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {analysis.overlap.length > 0 ? analysis.overlap.map((item: {name: string, code: string, badge?: string}, idx: number) => (
                                    <span 
                                      key={`${item.code}-${idx}`} 
                                      title={item.badge || "양매수 동시 포착 종목"}
                                      className="px-2.5 py-1 bg-stock-up/10 text-stock-up text-[10.5px] md:text-xs font-black rounded-full border border-stock-up/20 cursor-pointer hover:bg-stock-up/20 transition-all flex items-center gap-1 select-none"
                                      onClick={(e) => handleStockClick(e, item.code, item.name)}
                                    >
                                        {item.name}
                                        {item.badge && <span className="text-[9px] opacity-80" aria-label="badge indicator">🔥</span>}
                                    </span>
                                )) : <span className="text-[10.5px] md:text-xs text-muted-foreground italic">포착된 종목 없음</span>}
                            </div>
                        </div>

                        {/* Dominant Industry */}
                        <div className="flex flex-col gap-1.5">
                            <div className="flex items-center gap-2 text-[11px] md:text-xs font-extrabold text-foreground/95 mb-1">
                                <Search className="w-3.5 h-3.5 text-primary" />
                                <span>주도 산업군 (섹터)</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {analysis.dominantIndustries.map((name: string, idx: number) => (
                                    <span key={`${name}-${idx}`} className="px-2.5 py-1 bg-primary/10 text-primary text-[10.5px] md:text-xs font-black rounded-full border border-primary/20">{name}</span>
                                ))}
                            </div>
                        </div>

                        {/* High Turnover */}
                        <div className="flex flex-col gap-1.5">
                            <div className="flex items-center gap-2 text-[11px] md:text-xs font-extrabold text-foreground/95 mb-1">
                                <Activity className="w-3.5 h-3.5 text-amber-500" />
                                <span>시총 대비 수급 집중주</span>
                            </div>
                            <div className="flex flex-wrap gap-2 max-h-60 overflow-y-auto pr-1 thin-scrollbar">
                                {analysis.highTurnover.length > 0 ? analysis.highTurnover.map((item: {name: string, code: string, badge?: string}, idx: number) => (
                                    <span 
                                      key={`${item.code}-${idx}`} 
                                      title={item.badge || "시총 대비 수급 집중주"}
                                      className="px-2.5 py-1 bg-amber-500/20 text-amber-300 text-[10.5px] md:text-xs font-black rounded-full border border-amber-500/30 cursor-pointer hover:bg-amber-500/40 transition-all flex items-center gap-1 select-none"
                                      onClick={(e) => handleStockClick(e, item.code, item.name)}
                                    >
                                        {item.name}
                                        {item.badge && <span className="text-[9px] opacity-85" aria-label="badge indicator">⚡</span>}
                                    </span>
                                )) : <span className="text-[10.5px] md:text-xs text-muted-foreground italic">데이터 분석 중</span>}
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

      {/* Confirm Popup: Desktop = mouse-following / Mobile = bottom sheet */}
      {confirmState && (
        <>
          {/* Desktop popup (mouse-following) */}
          <div 
            className="hidden md:block fixed z-[9999] bg-background/95 backdrop-blur-xl border border-primary/30 rounded-xl shadow-2xl p-4 min-w-[220px] animate-in zoom-in-95 fade-in duration-200"
            style={{ 
              left: confirmState.x + 10, 
              top: Math.min(confirmState.y + 10, typeof window !== 'undefined' ? window.innerHeight - 150 : confirmState.y) 
            }}
          >
            <div className="flex items-center gap-2 mb-3">
              <Bot className="w-4 h-4 text-primary" />
              <span className="text-xs font-bold text-foreground">종목 분석을 할까요?</span>
            </div>
            <p className="text-[11px] font-bold text-muted-foreground mb-4">
              [{confirmState.name}] AI 심층 분석 리포트를 생성하시겠습니까?
            </p>
            <div className="flex gap-2">
              <button 
                onClick={() => {
                  onAnalyze?.(confirmState.code, confirmState.name);
                  setConfirmState(null);
                }}
                className="flex-1 bg-primary text-primary-foreground text-[10px] font-black py-1.5 rounded-md hover:bg-primary/90 transition-all shadow-md active:scale-95"
              >YES</button>
              <button 
                onClick={() => setConfirmState(null)}
                className="px-3 bg-muted text-muted-foreground text-[10px] font-bold py-1.5 rounded-md hover:bg-muted/70 transition-all"
              >NO</button>
            </div>
            <div className="absolute -top-2 left-4 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-b-[8px] border-b-primary/30" />
          </div>

          {/* Mobile bottom sheet popup */}
          <div className="md:hidden fixed z-[9999] bottom-0 left-0 right-0 bg-background/98 backdrop-blur-2xl border-t border-primary/30 rounded-t-2xl shadow-2xl p-5 animate-in slide-in-from-bottom duration-300" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)' }}>
            <div className="w-10 h-1 bg-muted-foreground/30 rounded-full mx-auto mb-4" />
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Bot className="w-5 h-5 text-primary" />
              </div>
              <span className="text-sm font-bold text-foreground">종목 분석을 할까요?</span>
            </div>
            <p className="text-xs font-bold text-muted-foreground mb-5">
              [{confirmState.name}] AI 심층 분석 리포트를 생성하시겠습니까?
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => {
                  onAnalyze?.(confirmState.code, confirmState.name);
                  setConfirmState(null);
                }}
                className="flex-1 bg-primary text-primary-foreground text-sm font-black py-3 rounded-xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 active:scale-[0.98]"
              >AI 분석 시작</button>
              <button 
                onClick={() => setConfirmState(null)}
                className="px-5 bg-muted text-muted-foreground text-sm font-bold py-3 rounded-xl hover:bg-muted/70 transition-all"
              >취소</button>
            </div>
          </div>
        </>
      )}
      
      {/* Background overlay to close popup on click outside */}
      {confirmState && (
        <div 
          className="fixed inset-0 z-[9998] bg-transparent" 
          onClick={(e) => {
            e.stopPropagation();
            setConfirmState(null);
          }}
        />
      )}
    </div>
  );
}
