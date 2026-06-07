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
  AlertCircle,
  RefreshCw
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
  fetchBacktestSummaryAction,
  getDebugInfoAction,
  type AnalysisMode
} from "./actions";
import { TradingViewChart } from "@/components/tradingview-chart";
import { FearGreedGauge } from "@/components/fear-greed-gauge";
import { CanaryCard } from "@/components/canary-card";
import { InvestorFlowCard } from "@/components/investor-flow-card";
import { WatchlistButton } from "@/components/ui/watchlist-button";
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
  AGGRESSIVE_LONG: { color: "text-red-500",       bg: "bg-red-500/10",   border: "border-red-500/30" },
  CAUTIOUS_LONG:   { color: "text-red-500",       bg: "bg-red-500/10",   border: "border-red-500/30" },
  MODERATE_LONG:   { color: "text-rose-400",       bg: "bg-rose-400/10",   border: "border-rose-400/30" },
  HOLD:            { color: "text-amber-500",      bg: "bg-amber-500/10",  border: "border-amber-500/30" },
  BEARISH_CAUTION: { color: "text-blue-400",      bg: "bg-blue-400/10",   border: "border-blue-400/30" },
  EXIT_PRIORITY:   { color: "text-blue-500",      bg: "bg-blue-500/10", border: "border-blue-500/30" },
  ACCUMULATION_WATCH: { color: "text-emerald-500", bg: "bg-emerald-500/10", border: "border-emerald-500/30" },
  MARKUP_CONFIRMED:   { color: "text-orange-500",  bg: "bg-orange-500/10",  border: "border-orange-500/30" },
  DISTRIBUTION_WARNING: { color: "text-purple-500", bg: "bg-purple-500/10", border: "border-purple-500/30" },
} as const;

const VERDICT_LABELS = {
  AGGRESSIVE_LONG: "상승 (적극 진입)",
  CAUTIOUS_LONG: "상승 (관망/주의)",
  HOLD: "중립 (보류)",
  EXIT_PRIORITY: "하락 (대피 우선)",
} as const;

const FINAL_VERDICT_STYLES = {
  "상승": { color: "text-red-500", bg: "bg-red-500/10", border: "border-red-500/30" },
  "하락": { color: "text-blue-500", bg: "bg-blue-500/10", border: "border-blue-500/30" },
  "횡보/보합": { color: "text-amber-500", bg: "bg-amber-500/10", border: "border-amber-500/30" },
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
  });

  const [backtestTrades, setBacktestTrades] = useState<any[]>([]);
  const [backtestSummary, setBacktestSummary] = useState<any>(null);
  const [backtestError, setBacktestError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<any>(null);

  useEffect(() => {
    setTimeStr(new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }));
    getDebugInfoAction().then(setDebugInfo).catch(err => console.error("Debug info error:", err));
    
    // 종목 마스터 JSON 로드
    fetch("/stocks.json")
      .then(res => res.json())
      .then(data => {
        setStocks(data);
        
        // URL의 ?code=402340 쿼리 파라미터가 존재할 시 자동 분석 실행
        const params = new URLSearchParams(window.location.search);
        const codeFromUrl = params.get("code");
        if (codeFromUrl && codeFromUrl.length >= 6) {
          setStockCode(codeFromUrl);
          const match = data.find((s: any) => s.code === codeFromUrl);
          if (match) {
            setSearchInput(match.name);
          } else {
            setSearchInput(codeFromUrl);
          }
          handleAnalyze(codeFromUrl, undefined, data);
        } else {
          // 로컬스토리지에서 최근 분석 종목 로드
          const lastCode = localStorage.getItem("stockpulse_last_analyzed_code");
          const lastName = localStorage.getItem("stockpulse_last_analyzed_name");
          if (lastCode && lastCode.length >= 6) {
            setStockCode(lastCode);
            const match = data.find((s: any) => s.code === lastCode);
            setSearchInput(match?.name || lastName || lastCode);
            handleAnalyze(lastCode, undefined, data);
          }
        }
      })
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

  // 분석 결과 완료 시 백테스트 타점 정보 자동 조회
  useEffect(() => {
    if (analysisResult?.success && analysisResult.stockData?.code) {
      setBacktestError(null);
      fetchBacktestSummaryAction(analysisResult.stockData.code)
        .then(json => {
          if (json.success && json.data) {
            setBacktestSummary(json.data);
            
            // 현재 선택된 mode에 매칭되는 trades를 동적으로 필터링하여 설정
            if (json.data.all_strategies) {
              const modeLabelMapping: Record<string, string> = {
                'scalp': 'AI 분석 (단타)',
                'swing': 'AI 분석 (스윙)',
                'position': 'AI 분석 (장기투자)'
              };
              const targetLabel = modeLabelMapping[mode];
              const targetStrategy = json.data.all_strategies.find((s: any) => s.strategy_name === targetLabel);
              if (targetStrategy && targetStrategy.trades) {
                setBacktestTrades(targetStrategy.trades);
                return;
              }
            }
            setBacktestTrades(json.data.trades || []);
          } else {
            setBacktestTrades([]);
            setBacktestSummary(null);
            if (!json.success) {
              setBacktestError(json.error || "데이터는 성공했으나 data가 null입니다.");
            } else {
              setBacktestError("데이터 없음 (Null)");
            }
          }
        })
        .catch(err => {
          console.error("Failed to fetch backtest trades", err);
          setBacktestTrades([]);
          setBacktestSummary(null);
          setBacktestError(err.message || "네트워크/서버 액션 에러");
        });
    } else {
      setBacktestTrades([]);
      setBacktestSummary(null);
      setBacktestError(null);
    }
  }, [analysisResult]);

  // 사용자가 선택한 mode 탭이 바뀌거나 backtestSummary가 새로 로드되었을 때,
  // 그에 부합하는 개별 전략의 trades를 즉시 추출하여 차트에 반영 (렉 없는 즉각 전환)
  useEffect(() => {
    if (backtestSummary && backtestSummary.all_strategies) {
      const modeLabelMapping: Record<string, string> = {
        'scalp': 'AI 분석 (단타)',
        'swing': 'AI 분석 (스윙)',
        'position': 'AI 분석 (장기투자)'
      };
      const targetLabel = modeLabelMapping[mode];
      const targetStrategy = backtestSummary.all_strategies.find((s: any) => s.strategy_name === targetLabel);
      if (targetStrategy && targetStrategy.trades) {
        setBacktestTrades(targetStrategy.trades);
      } else {
        // 일치하는 전략이 없을 때의 폴백
        setBacktestTrades(backtestSummary.trades || []);
      }
    }
  }, [mode, backtestSummary]);

  const filteredStocks = searchInput
    ? stocks.filter(s => s.name.toLowerCase().includes(searchInput.toLowerCase()) || s.code.includes(searchInput)).slice(0, 6)
    : [];

  const loadingMessages = [
    "데이터 요청 준비 중...",
    "KIS API 240 영업일 데이터 수집 및 무결성 검사 중...",
    "기술적 지표 및 3인 전문가 논의 중...",
    "의견 충돌 조율 및 최종 전략 시나리오 산출 중...",
    "Supabase DB 저장 중..."
  ];

  const handleAnalyze = async (
    codeToAnalyze?: string, 
    modeToAnalyze?: AnalysisMode, 
    stocksOverride?: {code: string, name: string, market: string}[],
    forceRefresh = false
  ) => {
    const target = codeToAnalyze || stockCode || searchInput;
    const activeMode = modeToAnalyze || mode;
    if (!target || target.length < 6) return;
    
    // stocksOverride가 있으면 사용 (useEffect 내부에서 호출 시 React state 반영 전이므로 직접 전달)
    const activeStocks = stocksOverride || stocks;
    
    let finalCode = target;
    if (!/^\d+$/.test(target)) {
      const match = activeStocks.find(s => s.name.toLowerCase() === target.toLowerCase());
      if (match) {
        finalCode = match.code;
        setStockCode(finalCode);
      } else {
        setAnalysisResult({ success: false, error: "유효한 종목코드 또는 이름이 아닙니다." });
        return;
      }
    }

    // 1. 세션 스토리지 캐시 확인 (강제 새로고침이 아닐 때)
    const cacheKey = `stockpulse_analysis_cache_${finalCode}_${activeMode}`;
    if (!forceRefresh) {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        try {
          const { timestamp, data } = JSON.parse(cached);
          const CACHE_EXPIRY_MS = 5 * 60 * 1000; // 5분
          if (Date.now() - timestamp < CACHE_EXPIRY_MS) {
            console.log(`[CACHE HIT] Loaded analysis for ${finalCode} (${activeMode}) from sessionStorage.`);
            setAnalysisResult(data);
            setIsAnalyzing(false);
            return;
          }
        } catch (e) {
          console.error("캐시 파싱 에러:", e);
        }
      }
    }

    setIsAnalyzing(true);
    setAnalysisResult(null);
    setLoadingStep(0);

    // 분석 시작 시 화면을 상단으로 올려 진행 상태와 결과를 모바일/데스크톱 모두에서 바로 보게 함
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    const interval = setInterval(() => {
      setLoadingStep((prev) => (prev < 4 ? prev + 1 : prev));
    }, 1200);

    try {
      // 프론트엔드 마스터 데이터에서 종목명을 찾아 백엔드에 전달 (백엔드 stocks.json 의존 제거)
      const stockMatch = activeStocks.find(s => s.code === finalCode);
      const result = await analyzeStockAction(finalCode, activeMode, stockMatch?.name);
      setAnalysisResult(result);
      if (result.success && result.stockData?.code) {
        localStorage.setItem("stockpulse_last_analyzed_code", result.stockData.code);
        localStorage.setItem("stockpulse_last_analyzed_name", result.stockData.name || stockMatch?.name || finalCode);
        
        // 캐시 저장
        sessionStorage.setItem(cacheKey, JSON.stringify({
          timestamp: Date.now(),
          data: result
        }));
      }
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
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4">
          {marketOverview.length > 0 ? marketOverview.map((item) => (
            <Card
              key={item.label}
              className="card-glow border-border/50 hover:border-primary/30 transition-all duration-300 bg-background/30 shadow-sm"
            >
              {/* 모바일에서 세로 박스 여유 공간(padding)을 줄이기 위해 p-2 md:p-4 적용 (글자 크기는 그대로 유지) */}
              <CardContent className="p-2 md:p-4">
                <div className="flex flex-col">
                  <span className="text-[9px] md:text-[10px] font-bold text-muted-foreground mb-0.5 uppercase tracking-widest">{item.label}</span>
                  <div className="flex items-center justify-between gap-0.5 md:gap-1">
                    <span className="text-sm md:text-xl font-black tracking-tighter font-mono truncate">{item.value}</span>
                    <div className={`flex items-center gap-0.5 md:gap-1 text-[10px] font-black ${directionColor(item.direction)}`}>
                        <DirectionIcon direction={item.direction} />
                        {item.changePercent}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )) : (
            // Loading skeleton - 모바일에서는 높이 h-14, 데스크톱에서는 md:h-20으로 최적화
            [...Array(4)].map((_, i) => (
                <div key={i} className="h-14 md:h-20 bg-muted/20 animate-pulse rounded-xl border border-border/50"></div>
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
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="text-xl md:text-3xl font-black">{analysisResult.stockData.name} <span className="text-sm md:text-lg text-muted-foreground font-mono font-normal tracking-wider ml-1">({analysisResult.stockData.code})</span></h3>
                      <div className="flex items-center gap-2">
                        <WatchlistButton stockCode={analysisResult.stockData.code} stockName={analysisResult.stockData.name} />
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 text-muted-foreground hover:text-foreground"
                          onClick={() => handleAnalyze(analysisResult.stockData.code, mode, undefined, true)}
                          disabled={isAnalyzing}
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${isAnalyzing ? "animate-spin" : ""}`} />
                          실시간 재분석
                        </Button>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 md:gap-3 mt-1.5">
                      <span className="text-lg md:text-2xl font-black font-mono tracking-tighter">
                         ₩{analysisResult.stockData.currentPrice.toLocaleString()}
                      </span>
                      <Badge variant="outline" className={`border-current font-bold ${directionColor(analysisResult.stockData.change > 0 ? "up" : "down")}`}>
                        {analysisResult.stockData.change > 0 ? "▲" : "▼"}{Math.abs(analysisResult.stockData.changePercent)}%
                      </Badge>
                      
                      {/* 종합 결과 방향성 배지 추가 */}
                      {analysisResult.analysis?.finalVerdict && (
                        <>
                          {/* 1. 전문가 순수 합의 라벨 */}
                          <Badge 
                            variant="outline"
                            className={`border-current font-bold ${
                              FINAL_VERDICT_STYLES[
                                (analysisResult.analysis.veto?.triggered
                                  ? (analysisResult.analysis.weightedScore > 0.2
                                      ? "상승"
                                      : analysisResult.analysis.weightedScore < -0.2
                                      ? "하락"
                                      : "횡보/보합")
                                  : analysisResult.analysis.finalVerdict) as keyof typeof FINAL_VERDICT_STYLES
                              ]?.color || "text-muted-foreground"
                            }`}
                          >
                            전문가 합의 : {
                              analysisResult.analysis.veto?.triggered
                                ? (analysisResult.analysis.weightedScore > 0.2
                                    ? "상승"
                                    : analysisResult.analysis.weightedScore < -0.2
                                    ? "하락"
                                    : "횡보/보합")
                                : analysisResult.analysis.finalVerdict
                            }
                          </Badge>

                          {/* 2. 시장 상태 (히스테리시스 룰 기반) 라벨 */}
                          {analysisResult.analysis.marketState && (
                            <Badge 
                              variant="outline"
                              className={`border-current font-bold ${
                                STATE_STYLES[
                                  analysisResult.analysis.marketState as keyof typeof STATE_STYLES
                                ]?.color || "text-muted-foreground"
                              }`}
                            >
                              시장 상태 : {analysisResult.analysis.marketStateLabel}
                            </Badge>
                          )}

                          {/* 3. 거부권 제어 발동 시 독립 라벨 추가 */}
                          {analysisResult.analysis.veto?.triggered && (
                            <Badge 
                              variant="outline"
                              className={`border-current font-bold ${
                                analysisResult.analysis.veto.priority === 'P1'
                                  ? "text-red-500"
                                  : "text-amber-500"
                              }`}
                            >
                              🚨 거부권 발동
                            </Badge>
                          )}

                          {/* 4. 변동성 레지임 배지 */}
                          {analysisResult.analysis.indicators?.volatilityRegime && (
                            <Badge 
                              variant="outline"
                              className={`border-current font-bold ${
                                analysisResult.analysis.indicators.volatilityRegime === 'EXTREME' ? 'bg-red-500/20 text-red-400 border-red-500/30 shadow-[0_0_8px_rgba(239,68,68,0.2)]' :
                                analysisResult.analysis.indicators.volatilityRegime === 'HIGH' ? 'bg-orange-500/20 text-orange-400 border-orange-500/30 shadow-[0_0_8px_rgba(249,115,22,0.2)]' :
                                analysisResult.analysis.indicators.volatilityRegime === 'LOW' ? 'bg-green-500/20 text-green-400 border-green-500/30 shadow-[0_0_8px_rgba(34,197,94,0.2)]' :
                                'bg-blue-500/20 text-blue-400 border-blue-500/30 shadow-[0_0_8px_rgba(59,130,246,0.2)]'
                              }`}
                            >
                              변동성: {analysisResult.analysis.indicators.volatilityRegime}
                            </Badge>
                          )}

                          {/* 5. TTM Squeeze 배지 */}
                          {analysisResult.analysis.indicators?.isSqueezed && (
                            <Badge 
                              variant="outline"
                              className="border-current font-bold bg-purple-500/20 text-purple-400 border-purple-500/30 shadow-[0_0_8px_rgba(168,85,247,0.2)]"
                            >
                              ⚡ TTM Squeeze 진행중
                            </Badge>
                          )}
                        </>
                      )}

                    </div>
                  </div>
                </div>

                {/* 백테스트 요약 결과 뱃지 UI */}
                {backtestSummary && (
                  <div className="flex flex-col gap-2 w-full mt-2 animate-in fade-in duration-300">
                    <div className="flex flex-wrap items-center gap-2 md:gap-3 p-3.5 bg-background/50 border border-primary/20 rounded-xl shadow-sm w-full">
                      <div className="flex items-center gap-1.5 shrink-0 bg-primary/10 text-primary px-2.5 py-1 rounded-md">
                        <Target className="w-4 h-4" />
                        <span className="font-bold text-sm">AI 최적전략: {backtestSummary.best_strategy_name}</span>
                      </div>
                      <Separator orientation="vertical" className="h-4 hidden sm:block bg-border/50" />
                      <div className="flex items-center gap-3 text-sm">
                        <div className="flex items-center gap-1.5">
                          <Activity className="w-4 h-4 text-muted-foreground" />
                          <span className="text-muted-foreground text-xs font-medium">과거 1년 승률</span>
                          <span className="font-black font-mono text-base">{backtestSummary.win_rate}%</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {backtestSummary.total_return > 0 ? <TrendingUp className="w-4 h-4 text-stock-up" /> : <TrendingDown className="w-4 h-4 text-stock-down" />}
                          <span className="text-muted-foreground text-xs font-medium">복리누적</span>
                          <span className={`font-black font-mono text-base ${backtestSummary.total_return > 0 ? 'text-stock-up' : 'text-stock-down'}`}>
                            {backtestSummary.total_return}%
                          </span>
                        </div>
                        <div className="flex items-center gap-1 ml-1 md:ml-3">
                          <span className="text-[10px] text-muted-foreground/80 bg-muted/50 px-2 py-0.5 rounded border border-border/50 font-mono">최대 낙폭: {backtestSummary.mdd}%</span>
                        </div>
                      </div>
                    </div>

                    {/* 모든 전략 비교 테이블 (단타/스윙/장기) */}
                    {backtestSummary.all_strategies && backtestSummary.all_strategies.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full">
                        {backtestSummary.all_strategies.map((st: any, idx: number) => {
                          const isBest = st.strategy_name === backtestSummary.best_strategy_name;
                          const modeMap: any = { "AI 분석 (단타)": "단타 모드", "AI 분석 (스윙)": "스윙 모드", "AI 분석 (장기투자)": "장기 모드" };
                          const label = modeMap[st.strategy_name] || st.strategy_name;
                          return (
                            <div key={idx} className={`flex flex-col p-2.5 rounded-lg border transition-all ${isBest ? 'bg-primary/5 border-primary/30 shadow-sm' : 'bg-background/40 border-border/50'}`}>
                              <div className="flex justify-between items-center mb-1.5">
                                <span className={`text-xs font-bold ${isBest ? 'text-primary' : 'text-muted-foreground'}`}>
                                  {label} {isBest && <span className="text-[9px] bg-primary/20 text-primary px-1 py-0.5 rounded ml-1">최적</span>}
                                </span>
                                <span className={`font-mono text-sm font-black ${st.total_return > 0 ? 'text-stock-up' : 'text-stock-down'}`}>
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
                    )}
                  </div>
                )}

                {/* 차트 영역을 분석 종목 주가 정보 밑(3인 전문가 및 기타 상세 의견 위)에 위치시킴 */}
                {analysisResult.stockData.ohlcv && (
                  <div className="bg-background/40 rounded-xl overflow-hidden border border-border/50 p-3 shadow-inner mt-2 animate-in fade-in duration-500 w-full">
                    <TradingViewChart 
                      data={analysisResult.stockData.ohlcv} 
                      trades={backtestTrades} 
                      swingLevels={analysisResult.analysis?.swingLevels}
                      volumeProfile={{
                        poc: analysisResult.analysis?.indicators?.volumeProfile240?.poc,
                        vah: analysisResult.analysis?.indicators?.volumeProfile240?.vah,
                        val: analysisResult.analysis?.indicators?.volumeProfile240?.val,
                      }}
                    />
                    
                    {/* 선 지표 설명 안내 영역 */}
                    <div className="mt-3 px-2 pt-3 border-t border-border/30 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-muted-foreground">
                      <div className="space-y-1">
                        <span className="font-bold text-foreground flex items-center gap-1.5">
                          <span className="w-1 h-3 bg-amber-500 rounded-sm"></span>
                          📊 볼륨 프로파일 (Volume Profile)
                        </span>
                        <p className="leading-relaxed text-[11px] text-muted-foreground/95">
                          <span className="text-amber-400 font-semibold">🟡 POC (Point of Control)</span>: 가장 많은 거래량이 누적된 핵심 가격대로 강력한 지지/저항 역할을 합니다.<br/>
                          <span className="text-foreground/70 font-semibold">⚪ VAH / VAL (가치영역 상/하단)</span>: 매물의 약 70%가 집중된 구간의 경계선입니다.
                        </p>
                      </div>
                      <div className="space-y-1">
                        <span className="font-bold text-foreground flex items-center gap-1.5">
                          <span className="w-1 h-3 bg-primary rounded-sm"></span>
                          📈 스윙 구조선 (Swing Levels)
                        </span>
                        <p className="leading-relaxed text-[11px] text-muted-foreground/95">
                          <span className="text-red-400 font-semibold">🔴 Res (Resistance)</span>: 최근 고점들을 연결한 매물 저항 구간입니다.<br/>
                          <span className="text-blue-400 font-semibold">🔵 Sup (Support)</span>: 최근 저점들을 연결한 매물 지지 구간이자 주요 손절선입니다.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {analysisResult.analysis.veto?.triggered && (
                  <div className="flex items-center gap-3.5 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-xs font-bold text-red-400 animate-in fade-in">
                    <span className="text-lg shrink-0">🚨</span>
                    <div>
                      <div className="font-black text-sm">
                        {analysisResult.analysis.veto.priority === 'P1' 
                          ? '경보 - 탈출 우선' 
                          : '홀딩 - 진입 보류(관망)'}
                        <span className="ml-2 font-normal text-[11px] text-red-400/70 block sm:inline-block mt-0.5 sm:mt-0">
                          (일반적인 경우에 따른 거부권입니다. 시장상황에 따라 달라질 수 있음을 유의하세요.)
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

                <div className="bg-background/50 rounded-xl border border-border/50 overflow-hidden flex flex-col shadow-sm">
                  <div className="bg-secondary/30 px-4 py-3 border-b border-border/50 flex items-center gap-2">
                    <Target className="w-4 h-4 text-chart-2" />
                    <span className="font-bold text-xs uppercase tracking-widest text-muted-foreground">Strategic Operation Plan</span>
                  </div>
                  <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Left Column: 진입 전략 및 손절가 (Entry Strategy & Stop Loss) */}
                    <div className="space-y-4">
                      <h4 className="text-xs md:text-sm font-bold text-white uppercase tracking-widest border-b border-border/50 pb-2 flex items-center gap-1.5">
                        <Target className="w-3.5 h-3.5 text-emerald-400" />
                        진입 전략 및 손절가 (Entry Strategy & Stop Loss)
                      </h4>
                      
                      <div className="flex justify-between items-center bg-emerald-500/5 border border-emerald-500/30 p-4 rounded-xl relative overflow-hidden group">
                        <div className="absolute left-0 top-0 w-1.5 h-full bg-emerald-500" />
                        <span className="text-xs md:text-sm font-black text-emerald-400 uppercase tracking-widest">Golden Entry Zone</span>
                        <span className="font-mono font-black text-xs md:text-sm text-white drop-shadow-sm">{analysisResult.analysis.strategy.entryRange}</span>
                      </div>

                      <div className="flex justify-between items-center bg-stock-down/5 border border-stock-down/20 p-4 rounded-xl hover:bg-stock-down/10 transition-colors relative overflow-hidden">
                        <div className="absolute left-0 top-0 w-1.5 h-full bg-stock-down" />
                        <span className="text-xs md:text-sm font-black text-stock-down uppercase tracking-tighter">Critical Risk Guard (Stop Loss)</span>
                        <span className="font-mono font-black text-xs md:text-sm text-white">₩{analysisResult.analysis.strategy.stopLoss.toLocaleString()}</span>
                      </div>
                    </div>

                    {/* Right Column: 상승 목표값 (Upside Targets) */}
                    <div className="space-y-4">
                      <h4 className="text-xs md:text-sm font-bold text-white uppercase tracking-widest border-b border-border/50 pb-2 flex items-center gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5 text-stock-up" />
                        상승 목표값 (Upside Targets)
                      </h4>

                      <div className="flex justify-between items-center bg-stock-up/5 border border-stock-up/10 p-4 rounded-xl">
                        <span className="text-xs md:text-sm font-black text-stock-up/80 uppercase tracking-tighter">Initial Target (Level 1)</span>
                        <span className="font-mono font-black text-xs md:text-sm text-white">₩{analysisResult.analysis.strategy.targetPrimary.toLocaleString()}</span>
                      </div>

                      <div className="flex justify-between items-center bg-stock-up/5 border border-stock-up/20 p-4 rounded-xl hover:bg-stock-up/10 transition-colors">
                        <span className="text-xs md:text-sm font-black text-stock-up uppercase tracking-tighter">Profit Target (Level 2)</span>
                        <span className="font-mono font-black text-xs md:text-sm text-white">₩{analysisResult.analysis.strategy.targetSecondary.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 차트는 주가 정보 하단으로 이동됨 */}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* --- [Market Indicators Section: Canary | Temperature | Investor Flow] --- */}
      <section id="market-indicators" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {/* [Canary] */}
        <div className="flex flex-col h-full animate-in fade-in slide-in-from-left-4 duration-500 delay-100">
           <CanaryCard 
             data={canaryData} 
             marketOverview={marketOverview}
             onAnalyze={(code, name) => {
               setStockCode(code);
               setSearchInput(name);
               handleAnalyze(code);
             }}
           />
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

    </div>
  );
}
