"use client";

import { useState, useEffect } from "react";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  BarChart3,
  Activity,
  Zap,
  Search,
  Bot,
  BrainCircuit,
  Gavel,
  Target,
  AlertCircle
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

import { 
  analyzeStockAction, 
  type StockAnalysisResponse, 
  fetchFearGreedAction, 
  fetchCanaryDataAction,
  fetchMarketOverviewAction,
  type AnalysisMode
} from "./actions";
import { TradingViewChart } from "@/components/tradingview-chart";
import { FearGreedGauge } from "@/components/fear-greed-gauge";
import { CanaryCard } from "@/components/canary-card";
import { InvestorFlowCard } from "@/components/investor-flow-card";
import { MacroIndicators } from "@/components/macro-indicators";
import { type FearGreedResponse } from "@/lib/api/feargreed";
import { type IndexPriceData } from "@/lib/api/kis-market";

const ANALYSIS_MODES = [
  { key: "scalp",    label: "단타",  desc: "모멘텀 우선 (당일~3일)" },
  { key: "swing",    label: "스윙",  desc: "추세 중심 (1~4주)" },
  { key: "position", label: "장기",  desc: "구조 우선 (1개월+)" },
] as const;

const WEIGHT_PROFILES = {
  scalp:    { trend: 0.20, energy: 0.30, momentum: 0.50 },
  swing:    { trend: 0.40, energy: 0.35, momentum: 0.25 },
  position: { trend: 0.55, energy: 0.30, momentum: 0.15 },
} as const;

const STATE_STYLES = {
  AGGRESSIVE_LONG: { color: "text-stock-up",       bg: "bg-stock-up/10",   border: "border-stock-up/30" },
  CAUTIOUS_LONG:   { color: "text-amber-400",       bg: "bg-amber-500/10",  border: "border-amber-500/30" },
  HOLD:            { color: "text-muted-foreground", bg: "bg-muted/20",      border: "border-border/30" },
  EXIT_PRIORITY:   { color: "text-stock-down",      bg: "bg-stock-down/10", border: "border-stock-down/30" },
} as const;

function DirectionIcon({ direction }: { direction: "up" | "down" | "flat" }) {
  if (direction === "up") return <TrendingUp className="w-4 h-4" />;
  if (direction === "down") return <TrendingDown className="w-4 h-4" />;
  return <Minus className="w-4 h-4" />;
}

function directionColor(direction: "up" | "down" | "flat" | string) {
  if (direction === "상승" || direction === "up") return "text-stock-up";
  if (direction === "하락" || direction === "down") return "text-stock-down";
  return "text-stock-flat";
}

export default function DashboardPage() {
  const [timeStr, setTimeStr] = useState("");
  const [stocks, setStocks] = useState<{code: string, name: string, market: string}[]>([]);

  // --- [Market Indicators State] ---
  const [marketOverview, setMarketOverview] = useState<IndexPriceData[]>([]);
  const [fearGreedData, setFearGreedData] = useState<FearGreedResponse | null>(null);
  const [canaryData, setCanaryData] = useState<any>({ 
    funds: null, 
    creditHistory: [], 
    adrKospi: null,
    adrKosdaq: null,
    newHighCount: 0,
    highTrend: []
  });

  useEffect(() => {
    setTimeStr(new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }));
    
    // 종목 마스터 JSON 로드
    fetch("/stocks.json")
      .then(res => res.json())
      .then(data => setStocks(data))
      .catch(err => console.error("stocks.json 로드 실패:", err));

    // 시장 지표 로드
    fetchMarketOverviewAction().then(setMarketOverview);
    fetchFearGreedAction().then(setFearGreedData);
    fetchCanaryDataAction().then(setCanaryData);
  }, []);

  // --- [AI Engine State] ---
  const [searchInput, setSearchInput] = useState("");
  const [stockCode, setStockCode] = useState("005930");
  const [showDropdown, setShowDropdown] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [analysisResult, setAnalysisResult] = useState<StockAnalysisResponse | null>(null);
  const [mode, setMode] = useState<AnalysisMode>("scalp");

  const filteredStocks = searchInput
    ? stocks.filter(s => s.name.includes(searchInput) || s.code.includes(searchInput)).slice(0, 6)
    : [];

  const loadingMessages = [
    "데이터 요청 준비 중...",
    "KIS API 240 영업일 데이터 수집 및 무결성 검사 중...",
    "기술적 지표 및 3인 전문가 논의 중...",
    "의견 충돌 조율 및 최종 전략 시나리오 산출 중...",
    "Supabase DB 저장 중..."
  ];

  const handleAnalyze = async (codeToAnalyze?: string, modeToAnalyze?: AnalysisMode) => {
    const target = codeToAnalyze || stockCode || searchInput;
    const activeMode = modeToAnalyze || mode;
    if (!target || target.length < 6) return;
    
    let finalCode = target;
    if (!/^\d+$/.test(target)) {
      const match = stocks.find(s => s.name === target);
      if (match) {
        finalCode = match.code;
        setStockCode(finalCode);
      } else {
        setAnalysisResult({ success: false, error: "유효한 종목코드 또는 이름이 아닙니다." });
        return;
      }
    }

    setIsAnalyzing(true);
    setAnalysisResult(null);
    setLoadingStep(0);

    const interval = setInterval(() => {
      setLoadingStep((prev) => (prev < 4 ? prev + 1 : prev));
    }, 1200);

    try {
      const result = await analyzeStockAction(finalCode, activeMode);
      setAnalysisResult(result);
    } catch (error) {
      console.error(error);
      setAnalysisResult({ success: false, error: "서버 액션 호출 실패" });
    } finally {
      clearInterval(interval);
      setLoadingStep(5);
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="px-5 py-4 md:px-6 md:py-6 lg:px-8 lg:py-8 space-y-6 md:space-y-8 w-full max-w-[1600px] mx-auto">
      {/* Page Header */}
      <header className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl md:text-3xl font-black tracking-tighter">AI STOCK DASHBOARD</h1>
            <p className="text-[11px] md:text-sm text-muted-foreground mt-0.5">
              실시간 주식 시세 및 AI 입체 분석
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] md:text-xs text-muted-foreground bg-secondary/50 px-2.5 py-1 rounded-full border border-border/50 shadow-sm shrink-0">
            <Clock className="w-3 h-3 text-primary" />
            <span className="font-mono">{timeStr}</span>
            <div className="w-1.5 h-1.5 rounded-full bg-stock-up animate-pulse" />
          </div>
        </div>
      </header>

      {/* Market Overview (Real-time Indexes) */}
      <section id="market-overview" className="animate-in fade-in slide-in-from-top-4 duration-700">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 md:gap-4">
          {marketOverview.length > 0 ? marketOverview.map((item) => (
            <Card
              key={item.label}
              className="card-glow border-border/50 hover:border-primary/30 transition-all duration-300 bg-background/30 shadow-sm"
            >
              <CardContent className="p-3 md:p-4">
                <div className="flex flex-col">
                  <span className="text-[9px] md:text-[10px] font-bold text-muted-foreground mb-0.5 uppercase tracking-widest">{item.label}</span>
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-sm md:text-xl font-black tracking-tighter font-mono truncate">{item.value}</span>
                    <div className={`flex items-center gap-1 text-[10px] font-black ${directionColor(item.direction)}`}>
                        <DirectionIcon direction={item.direction} />
                        {item.changePercent}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )) : (
            // Loading skeleton
            [...Array(4)].map((_, i) => (
                <div key={i} className="h-20 bg-muted/20 animate-pulse rounded-xl border border-border/50"></div>
            ))
          )}
        </div>
      </section>

      {/* Top Section: Analysis Engine */}
      <section className="space-y-4">
        <Card className="border-primary/20 bg-primary/5 shadow-2xl shadow-primary/5 card-glow relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
            <BrainCircuit className="w-32 h-32" />
          </div>
          
          <CardHeader className="pb-3 border-b border-border/50 bg-background/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-primary/10 rounded-lg">
                    <BrainCircuit className="w-6 h-6 text-primary" />
                </div>
                <CardTitle className="text-xl font-bold tracking-tight">AI 입체 분석 엔진</CardTitle>
                <Badge variant="secondary" className="bg-primary/20 text-primary border-primary/30">v2.0 Beta</Badge>
              </div>
            </div>
            <CardDescription className="text-sm">
              3인의 가상 전문가 논쟁을 통한 피보나치 & ATR 기반 정밀 타점 산출
            </CardDescription>
          </CardHeader>
          
          <CardContent className="pt-5 space-y-6">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1 w-full md:max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="종목명 또는 코드 검색 (예: 삼성전자)"
                  value={searchInput}
                  onChange={(e) => {
                    setSearchInput(e.target.value);
                    setShowDropdown(true);
                  }}
                  onFocus={() => setShowDropdown(true)}
                  onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (filteredStocks.length > 0) {
                        setStockCode(filteredStocks[0].code);
                        setSearchInput(filteredStocks[0].name);
                        setShowDropdown(false);
                        handleAnalyze(filteredStocks[0].code);
                      } else {
                        handleAnalyze(searchInput);
                      }
                    }
                  }}
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-background border border-border/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-sans shadow-inner"
                  disabled={isAnalyzing}
                />
                
                {showDropdown && searchInput && (
                   <div className="absolute top-full left-0 w-full mt-2 bg-background/95 backdrop-blur-md border border-border/50 rounded-lg shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200">
                     {filteredStocks.length > 0 ? (
                       <ul className="py-1">
                          {filteredStocks.map(stock => (
                            <li 
                              key={stock.code}
                              className="px-4 py-3 md:py-2.5 hover:bg-primary/10 cursor-pointer flex justify-between items-center group border-b border-border/30 last:border-0"
                              onClick={() => {
                                 setStockCode(stock.code);
                                 setSearchInput(stock.name);
                                 setShowDropdown(false);
                                 handleAnalyze(stock.code);
                              }}
                            >
                              <span className="text-sm font-bold group-hover:text-primary transition-colors">{stock.name}</span>
                              <span className="text-muted-foreground font-mono text-[10px] px-1.5 py-0.5 rounded bg-muted/50 border border-border/50">{stock.code}</span>
                            </li>
                          ))}
                       </ul>
                     ) : (
                       <div className="p-4 text-xs text-muted-foreground text-center italic">검색 결과가 없습니다.</div>
                     )}
                   </div>
                )}
              </div>
              <Button 
                onClick={() => handleAnalyze()} 
                disabled={isAnalyzing || (!stockCode && searchInput.length === 0)}
                className="gap-2 w-full sm:w-auto transition-all shadow-lg shadow-primary/20 h-[44px] px-6"
              >
                <Bot className="w-4 h-4" />
                {isAnalyzing ? "AI 분석 중..." : "분석 시작"}
              </Button>
            </div>

            {isAnalyzing && (
              <div className="space-y-3 bg-background/50 p-4 rounded-xl border border-border/50 animate-in fade-in slide-in-from-bottom-2">
                <div className="flex items-center justify-between text-sm font-medium">
                  <span className="text-primary animate-pulse">{loadingMessages[loadingStep] || "최종 검토 완료"}</span>
                  <span className="text-muted-foreground font-mono">{Math.min((loadingStep + 1) * 20, 100)}%</span>
                </div>
                <Progress value={(loadingStep + 1) * 20} className="h-1.5" />
              </div>
            )}

            {!isAnalyzing && analysisResult && !analysisResult.success && (
              <div className="bg-destructive/10 text-destructive p-4 rounded-xl border border-destructive/20 flex gap-3 text-sm">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p>{analysisResult.error}</p>
              </div>
            )}

            {!isAnalyzing && analysisResult?.success && analysisResult.analysis && analysisResult.stockData && (
              <div className="space-y-6 animate-in zoom-in-95 duration-500">
                <Separator className="bg-border/50" />
                
                {/* 단기, 스윙, 장기 탭 버튼 */}
                <div className="flex bg-muted/40 p-0.5 rounded-lg text-xs font-bold border border-border/50 mb-4">
                  {ANALYSIS_MODES.map(m => (
                    <button
                      key={m.key}
                      onClick={() => {
                        setMode(m.key);
                        if (analysisResult?.success) {
                          handleAnalyze(stockCode, m.key);
                        }
                      }}
                      className={`flex-1 py-1.5 px-3 rounded-md transition-all ${
                        mode === m.key
                          ? 'bg-background text-primary shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {m.label}
                      <span className="block text-[9px] font-normal opacity-60">{m.desc}</span>
                    </button>
                  ))}
                </div>

                {/* 실시간 3인 전문가 분석 기여도 분포 가로 바 */}
                <div className="bg-background/30 rounded-xl p-3.5 border border-border/50 space-y-2 mb-6 animate-in fade-in duration-300">
                  <div className="flex justify-between items-center text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    <span>실시간 3인 전문가 의사결정 기여도</span>
                    <span className="font-mono text-primary bg-primary/10 px-2.5 py-0.5 rounded-md border border-primary/20 text-[9px]">{mode.toUpperCase()} 모드</span>
                  </div>
                  <div className="h-3.5 w-full rounded-full overflow-hidden flex bg-muted/50 border border-border/30 shadow-inner">
                    <div 
                      className="bg-stock-up/85 hover:bg-stock-up transition-all duration-300 relative flex items-center justify-center"
                      style={{ width: `${Math.round(WEIGHT_PROFILES[mode].momentum * 100)}%` }}
                      title={`모멘텀 전문가: ${Math.round(WEIGHT_PROFILES[mode].momentum * 100)}%`}
                    >
                      <span className="text-[8px] font-black text-white opacity-95 truncate px-1">모멘텀 {Math.round(WEIGHT_PROFILES[mode].momentum * 100)}%</span>
                    </div>
                    <div 
                      className="bg-amber-400/85 hover:bg-amber-400 transition-all duration-300 relative flex items-center justify-center"
                      style={{ width: `${Math.round(WEIGHT_PROFILES[mode].trend * 100)}%` }}
                      title={`파동/추세 전문가: ${Math.round(WEIGHT_PROFILES[mode].trend * 100)}%`}
                    >
                      <span className="text-[8px] font-black text-slate-900 opacity-95 truncate px-1">추세 {Math.round(WEIGHT_PROFILES[mode].trend * 100)}%</span>
                    </div>
                    <div 
                      className="bg-blue-400/85 hover:bg-blue-400 transition-all duration-300 relative flex items-center justify-center"
                      style={{ width: `${Math.round(WEIGHT_PROFILES[mode].energy * 100)}%` }}
                      title={`에너지 전문가: ${Math.round(WEIGHT_PROFILES[mode].energy * 100)}%`}
                    >
                      <span className="text-[8px] font-black text-white opacity-95 truncate px-1">수급 {Math.round(WEIGHT_PROFILES[mode].energy * 100)}%</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                  <div>
                    <h3 className="text-xl md:text-3xl font-black">{analysisResult.stockData.name} <span className="text-sm md:text-lg text-muted-foreground font-mono font-normal tracking-wider ml-1">({analysisResult.stockData.code})</span></h3>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-lg md:text-2xl font-black font-mono tracking-tighter">
                         ₩{analysisResult.stockData.currentPrice.toLocaleString()}
                      </span>
                      <Badge variant="outline" className={`border-current font-bold ${directionColor(analysisResult.stockData.change > 0 ? "up" : "down")}`}>
                        {analysisResult.stockData.change > 0 ? "▲" : "▼"}{Math.abs(analysisResult.stockData.changePercent)}%
                      </Badge>
                    </div>
                  </div>
                </div>

                {analysisResult.analysis.veto?.triggered && (
                  <div className="flex items-center gap-3.5 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-xs font-bold text-red-400 animate-in fade-in">
                    <span className="text-lg shrink-0">🚨</span>
                    <div>
                      <div className="font-black text-sm">
                        {analysisResult.analysis.veto.priority === 'P1' 
                          ? '경보 - 탈출 우선' 
                          : '홀딩 - 진입 보류(관망)'}
                        <span className="ml-2 font-normal text-[11px] text-red-400/70 block sm:inline-block mt-0.5 sm:mt-0">
                          {analysisResult.analysis.veto.priority === 'P1'
                            ? '(단, 극단적 모멘텀이나 광풍 장세에서는 과열 지표를 무시하고 추가 폭등이 나타날 수 있습니다.)'
                            : '(단, 박스권 횡보 수렴 이후 거래량이 급증하면 상방 또는 하방으로 강력한 방향성 돌파가 일어날 수 있습니다.)'}
                        </span>
                      </div>
                      <div className="font-normal text-red-300/80 mt-1">{analysisResult.analysis.veto.reason}</div>
                      <div className="font-mono text-[10px] text-red-400/60 mt-0.5">트리거: {analysisResult.analysis.veto.source}</div>
                    </div>
                  </div>
                )}

                {/* 3인 전문가 카드 */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {analysisResult.analysis.experts.map((exp, idx) => {
                    const getWeight = (name: string) => {
                      if (name.includes("추세")) return WEIGHT_PROFILES[mode].trend;
                      if (name.includes("에너지")) return WEIGHT_PROFILES[mode].energy;
                      if (name.includes("모멘텀")) return WEIGHT_PROFILES[mode].momentum;
                      return 0;
                    };
                    const weightPercent = Math.round(getWeight(exp.expertName) * 100);

                    return (
                      <div key={idx} className="bg-background/80 rounded-xl p-4 border border-border/50 shadow-sm relative overflow-hidden group hover:scale-[1.02] transition-transform duration-300">
                        <div className={`absolute top-0 right-0 w-1.5 h-full ${directionColor(exp.opinion).replace('text-', 'bg-')} opacity-30`}/>
                        <h4 className="font-bold text-sm flex justify-between items-center mb-1">
                          {exp.expertName}
                          <div className="flex items-center gap-1.5">
                            {exp.vetoTriggered && <span title={exp.vetoReason} className="text-base leading-none">⚠️</span>}
                            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${directionColor(exp.opinion).replace('text-', 'bg-')}/10 ${directionColor(exp.opinion)}`}>{exp.opinion}</span>
                          </div>
                        </h4>
                        
                        {/* 반영 가중치 배지 */}
                        <div className="text-[9px] font-bold text-muted-foreground/80 mb-2 flex items-center gap-1">
                          <Zap className="w-2.5 h-2.5 text-amber-400" />
                          최종 의사결정 반영 비중: <span className="text-primary font-mono font-bold">{weightPercent}%</span>
                        </div>

                        <div className="flex items-center gap-2 mb-3">
                            <Progress value={exp.confidence} className="h-1 flex-1 bg-secondary" />
                            <span className="text-[9px] font-mono font-bold text-muted-foreground">{exp.confidence}%</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-relaxed italic">"{exp.reason}"</p>
                      </div>
                    );
                  })}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-background/50 rounded-xl border border-border/50 overflow-hidden flex flex-col h-[350px] shadow-sm">
                    <div className="bg-secondary/30 px-4 py-3 border-b border-border/50 flex items-center gap-2">
                      <Gavel className="w-4 h-4 text-chart-4" />
                      <span className="font-bold text-xs uppercase tracking-widest text-muted-foreground">Audit & Cross-Reference Log</span>
                    </div>
                    <ScrollArea className="flex-1 p-4">
                      <div className="space-y-4">
                         {analysisResult.analysis.auditLogs.map((log, idx) => (
                           <div key={idx} className={`flex gap-3 items-start ${log.vetoTriggered ? 'bg-red-500/10 p-2.5 rounded-lg border border-red-500/20' : ''}`}>
                              <div className="shrink-0 w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center text-[10px] font-black text-primary border border-primary/20 mt-1">
                                {log.step}
                              </div>
                              <div className="flex-1">
                                <span className="text-[10px] font-black block mb-1 text-primary italic">{log.expertName} → AUDIT</span>
                                <p className="text-[11px] font-medium rounded-lg bg-secondary/50 p-3 leading-relaxed text-muted-foreground border border-border/50 shadow-sm">
                                  {log.message}
                                </p>
                              </div>
                           </div>
                         ))}
                      </div>
                    </ScrollArea>
                  </div>

                  <div className="bg-background/50 rounded-xl border border-border/50 overflow-hidden flex flex-col h-[350px] shadow-sm">
                    <div className="bg-secondary/30 px-4 py-3 border-b border-border/50 flex items-center gap-2">
                      <Target className="w-4 h-4 text-chart-2" />
                      <span className="font-bold text-xs uppercase tracking-widest text-muted-foreground">Strategic Operation Plan</span>
                    </div>
                    <div className="p-5 flex-1 flex flex-col justify-center space-y-3">
                      <div className="flex justify-between items-center bg-stock-up/5 border border-stock-up/20 p-3.5 rounded-xl hover:bg-stock-up/10 transition-colors">
                        <span className="text-[10px] text-stock-up font-black uppercase tracking-tighter">Profit Target (Level 2)</span>
                        <span className="font-mono font-black text-lg">₩{analysisResult.analysis.strategy.targetSecondary.toLocaleString()}</span>
                      </div>
                      
                      <div className="flex justify-between items-center bg-stock-up/5 border border-stock-up/10 p-3.5 rounded-xl">
                        <span className="text-[10px] text-stock-up/80 font-black uppercase tracking-tighter">Initial Target (Level 1)</span>
                        <span className="font-mono font-bold text-md">₩{analysisResult.analysis.strategy.targetPrimary.toLocaleString()}</span>
                      </div>
                      
                      <div className="flex justify-between items-center bg-primary/5 border border-primary/30 p-4 rounded-xl relative overflow-hidden group">
                        <div className="absolute left-0 top-0 w-1.5 h-full bg-primary" />
                        <span className="text-[10px] text-primary font-black uppercase tracking-widest">Golden Entry Zone</span>
                        <span className="font-mono font-black text-xl text-primary drop-shadow-sm">{analysisResult.analysis.strategy.entryRange}</span>
                      </div>
                      
                      <div className="flex justify-between items-center bg-stock-down/5 border border-stock-down/20 p-3.5 rounded-xl hover:bg-stock-down/10 transition-colors">
                        <span className="text-[10px] text-stock-down font-black uppercase tracking-tighter">Critical Risk Guard</span>
                        <span className="font-mono font-black text-lg">₩{analysisResult.analysis.strategy.stopLoss.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {analysisResult.stockData.ohlcv && (
                  <div className="bg-background/40 rounded-xl overflow-hidden border border-border/50 p-2 shadow-inner mt-6 animate-in fade-in duration-500">
                    <TradingViewChart data={analysisResult.stockData.ohlcv} />
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* --- [Market Indicators Section: Canary | Temperature | Investor Flow] --- */}
      <section id="market-indicators" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {/* [Canary] */}
        <div className="flex flex-col h-full animate-in fade-in slide-in-from-left-4 duration-500 delay-100">
           <CanaryCard data={canaryData} />
        </div>

        {/* [Temperature] */}
        <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200">
           {fearGreedData ? (
             <div className="grid grid-cols-1 gap-4 h-full">
                <FearGreedGauge data={fearGreedData.kr} title="KOREA MARKET TEMPERATURE" />
                <FearGreedGauge data={fearGreedData.us} title="US MARKET TEMPERATURE" />
             </div>
           ) : (
             <div className="bg-background/40 rounded-xl border border-border/50 h-full animate-pulse flex items-center justify-center text-xs text-muted-foreground">
                점검 중...
             </div>
           )}
        </div>

        {/* [Investor Flow] */}
        <div className="flex flex-col h-full animate-in fade-in slide-in-from-right-4 duration-500 delay-300">
           <InvestorFlowCard 
             onAnalyze={(code, name) => {
               setStockCode(code);
               setSearchInput(name);
               handleAnalyze(code);
             }} 
           />
        </div>
      </section>

      {/* --- [Macro Indicators Section: Ratios and Gap Analysis] --- */}
      <section id="macro-indicators" className="mt-8 animate-in fade-in slide-in-from-bottom-6 duration-500 delay-400">
         <MacroIndicators canaryData={canaryData} marketOverview={marketOverview} />
      </section>

    </div>
  );
}
