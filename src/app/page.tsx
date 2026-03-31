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

import { analyzeStockAction, type StockAnalysisResponse } from "./actions";
import { TradingViewChart } from "@/components/tradingview-chart";

// --- [Dummy Data] ---
const marketOverview = [
  { label: "코스피", value: "2,687.45", change: "+12.34", changePercent: "+0.46%", direction: "up" as const },
  { label: "코스닥", value: "872.31", change: "-3.21", changePercent: "-0.37%", direction: "down" as const },
  { label: "코스피200", value: "362.18", change: "+1.87", changePercent: "+0.52%", direction: "up" as const },
  { label: "원/달러", value: "1,432.50", change: "0.00", changePercent: "0.00%", direction: "flat" as const },
];

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

  useEffect(() => {
    setTimeStr(new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }));
    // 종목 마스터 JSON 로드
    fetch("/stocks.json")
      .then(res => res.json())
      .then(data => setStocks(data))
      .catch(err => console.error("stocks.json 로드 실패:", err));
  }, []);

  // --- [AI Engine State] ---
  const [searchInput, setSearchInput] = useState("");
  const [stockCode, setStockCode] = useState("005930");
  const [showDropdown, setShowDropdown] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [analysisResult, setAnalysisResult] = useState<StockAnalysisResponse | null>(null);

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

  const handleAnalyze = async (codeToAnalyze?: string) => {
    const target = codeToAnalyze || stockCode || searchInput;
    if (!target || target.length < 6) return;
    
    // 타겟이 숫자가 아닐 경우(이름을 바로 쳤을 경우), stocks 목록에서 코드를 찾음
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

    // 로딩 시뮬레이션을 비동기와 병행
    const interval = setInterval(() => {
      setLoadingStep((prev) => (prev < 4 ? prev + 1 : prev));
    }, 1200);

    try {
      const result = await analyzeStockAction(finalCode);
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
    <div className="p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto">
      {/* Page Header */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">대시보드</h1>
          <p className="text-sm text-muted-foreground mt-1">
            실시간 주식 시세 및 AI 입체 분석
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary/50 px-3 py-1.5 rounded-full">
          <Clock className="w-3.5 h-3.5" />
          <span>마지막 업데이트: {timeStr}</span>
          <div className="w-1.5 h-1.5 rounded-full bg-stock-up animate-live-pulse" />
        </div>
      </header>

      {/* --- [AI Analysis Engine Section] --- */}
      <section className="space-y-4">
        <Card className="border-primary/20 bg-primary/5 shadow-lg shadow-primary/5 card-glow relative overflow-hidden">
          <CardHeader className="pb-3 border-b border-border/50 bg-background/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BrainCircuit className="w-6 h-6 text-primary" />
                <CardTitle className="text-xl">입체 주식 분석 엔진</CardTitle>
                <Badge variant="secondary" className="bg-primary/20 text-primary border-primary/30">Alpha</Badge>
              </div>
            </div>
            <CardDescription className="text-sm">
              한국투자증권 실거래 API와 3인의 전문가 AI가 상호 논쟁을 통해 최적의 매매 시나리오를 찾습니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-5 space-y-6">
            
            {/* Search Input Area */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1 max-w-sm">
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
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-background border border-border/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-sans"
                  disabled={isAnalyzing}
                />
                
                {/* Autocomplete Dropdown */}
                {showDropdown && searchInput && (
                   <div className="absolute top-full left-0 w-full mt-2 bg-background border border-border/50 rounded-lg shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200">
                     {filteredStocks.length > 0 ? (
                       <ul className="py-1">
                          {filteredStocks.map(stock => (
                            <li 
                              key={stock.code}
                              className="px-4 py-2 hover:bg-secondary cursor-pointer flex justify-between items-center group"
                              onClick={() => {
                                 setStockCode(stock.code);
                                 setSearchInput(stock.name);
                                 setShowDropdown(false);
                                 handleAnalyze(stock.code);
                              }}
                            >
                              <span className="text-sm font-medium group-hover:text-primary transition-colors">{stock.name}</span>
                              <span className="text-muted-foreground font-mono text-xs px-2 py-0.5 rounded bg-muted/50">{stock.code}</span>
                            </li>
                          ))}
                       </ul>
                     ) : (
                       <div className="p-3 text-sm text-muted-foreground text-center">검색 결과가 없습니다.</div>
                     )}
                   </div>
                )}
              </div>
              <Button 
                onClick={() => handleAnalyze()} 
                disabled={isAnalyzing || (!stockCode && searchInput.length === 0)}
                className="gap-2 sm:w-auto w-full transition-all"
              >
                <Bot className="w-4 h-4" />
                {isAnalyzing ? "분석중..." : "입체 분석 시작"}
              </Button>
            </div>

            {/* Loading State */}
            {isAnalyzing && (
              <div className="space-y-3 bg-background/50 p-4 rounded-xl border border-border/50 animate-in fade-in slide-in-from-bottom-2">
                <div className="flex items-center justify-between text-sm font-medium">
                  <span className="text-primary">{loadingMessages[loadingStep] || "최종 검토 완료"}</span>
                  <span className="text-muted-foreground">{Math.min((loadingStep + 1) * 20, 100)}%</span>
                </div>
                <Progress value={(loadingStep + 1) * 20} className="h-2" />
              </div>
            )}

            {/* Error State */}
            {!isAnalyzing && analysisResult && !analysisResult.success && (
              <div className="bg-destructive/10 text-destructive p-4 rounded-xl border border-destructive/20 flex gap-3 text-sm">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p>{analysisResult.error}</p>
              </div>
            )}

            {/* Success Result State */}
            {!isAnalyzing && analysisResult?.success && analysisResult.analysis && analysisResult.stockData && (
              <div className="space-y-6 animate-in zoom-in-95 duration-300">
                <Separator className="bg-border/50" />
                
                {/* Header info */}
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                  <div>
                    <h3 className="text-2xl font-bold">{analysisResult.stockData.name} <span className="text-lg text-muted-foreground font-mono font-normal">({analysisResult.stockData.code})</span></h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xl font-bold font-mono">
                         ₩{analysisResult.stockData.currentPrice.toLocaleString()}
                      </span>
                      <Badge variant="outline" className={`border-current ${directionColor(analysisResult.stockData.change > 0 ? "up" : "down")}`}>
                        {analysisResult.stockData.change > 0 ? "+" : ""}{analysisResult.stockData.changePercent}%
                      </Badge>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground mb-1">최종 방향성 결론</p>
                    <Badge className={`text-sm px-4 py-1 flex gap-1 ${analysisResult.analysis.finalVerdict === "상승" ? "bg-stock-up hover:bg-stock-up/90 text-white" : analysisResult.analysis.finalVerdict === "하락" ? "bg-stock-down hover:bg-stock-down/90 text-white" : "bg-stock-flat"}`}>
                       {analysisResult.analysis.finalVerdict === "상승" && <TrendingUp className="w-4 h-4" />}
                       {analysisResult.analysis.finalVerdict === "하락" && <TrendingDown className="w-4 h-4" />}
                       {analysisResult.analysis.finalVerdict} (3인 전문가 투표결과)
                    </Badge>
                  </div>
                </div>

                {/* --- [Candlestick Chart Area] --- */}
                {analysisResult.stockData.ohlcv && (
                  <div className="bg-background/40 rounded-xl overflow-hidden border border-border/50 p-2">
                    <TradingViewChart data={analysisResult.stockData.ohlcv} />
                  </div>
                )}

                {/* 3 Experts */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {analysisResult.analysis.experts.map((exp, idx) => (
                    <div key={idx} className="bg-background/80 rounded-xl p-4 border border-border/50 shadow-sm relative overflow-hidden group">
                      <div className={`absolute top-0 right-0 w-1.5 h-full ${directionColor(exp.opinion).replace('text-', 'bg-')} opacity-50`}/>
                      <h4 className="font-semibold flex justify-between items-center mb-2">
                        {exp.expertName}
                        <span className={`text-xs font-bold ${directionColor(exp.opinion)}`}>{exp.opinion}</span>
                      </h4>
                      <Progress value={exp.confidence} className="h-1 mb-3 bg-secondary" />
                      <p className="text-xs text-muted-foreground leading-relaxed">{exp.reason}</p>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Audit Logs */}
                  <div className="bg-background/50 rounded-xl border border-border/50 overflow-hidden flex flex-col h-64">
                    <div className="bg-secondary/30 px-4 py-3 border-b border-border/50 flex items-center gap-2">
                      <Gavel className="w-4 h-4 text-chart-4" />
                      <span className="font-medium text-sm">상호 반박 & Audit Log</span>
                    </div>
                    <ScrollArea className="flex-1 p-4">
                      <div className="space-y-4">
                         {analysisResult.analysis.auditLogs.map((log, idx) => (
                           <div key={idx} className="flex gap-3">
                              <div className="shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary border border-primary/20">
                                {log.step}
                              </div>
                              <div className="pt-0.5">
                                <span className="text-xs font-semibold block mb-0.5 text-foreground/80">{log.expertName}</span>
                                <p className="text-xs rounded bg-secondary/50 p-2.5 leading-relaxed text-muted-foreground border border-border/50">
                                  {log.message}
                                </p>
                              </div>
                           </div>
                         ))}
                      </div>
                    </ScrollArea>
                  </div>

                  {/* Strategy */}
                  <div className="bg-background/50 rounded-xl border border-border/50 overflow-hidden flex flex-col h-auto min-h-[16rem]">
                    <div className="bg-secondary/30 px-4 py-3 border-b border-border/50 flex items-center gap-2">
                      <Target className="w-4 h-4 text-chart-2" />
                      <span className="font-medium text-sm">피보나치 & ATR 대응 시나리오</span>
                    </div>
                    <div className="p-4 flex-1 flex flex-col justify-center space-y-4">
                      
                      <div className="flex justify-between items-center bg-stock-up/10 border border-stock-up/20 p-3 rounded-lg">
                        <span className="text-xs text-stock-up font-semibold">2차 익절 목표가</span>
                        <span className="font-mono font-bold">₩{analysisResult.analysis.strategy.targetSecondary.toLocaleString()}</span>
                      </div>
                      
                      <div className="flex justify-between items-center bg-stock-up/5 border border-stock-up/10 p-3 rounded-lg">
                        <span className="text-xs text-stock-up/80 font-semibold">1차 익절 목표가</span>
                        <span className="font-mono font-bold">₩{analysisResult.analysis.strategy.targetPrimary.toLocaleString()}</span>
                      </div>
                      
                      <div className="flex justify-between items-center bg-secondary/50 border border-border/50 p-3 rounded-lg relative overflow-hidden">
                        <div className="absolute left-0 top-0 w-1 h-full bg-primary" />
                        <span className="text-xs text-foreground font-semibold">권장 진입 구간 (Buy Zone)</span>
                        <span className="font-mono font-bold text-primary">{analysisResult.analysis.strategy.entryRange}</span>
                      </div>
                      
                      <div className="flex justify-between items-center bg-stock-down/10 border border-stock-down/20 p-3 rounded-lg">
                        <span className="text-xs text-stock-down font-semibold">절대 방어 손절가</span>
                        <span className="font-mono font-bold">₩{analysisResult.analysis.strategy.stopLoss.toLocaleString()}</span>
                      </div>

                    </div>
                  </div>
                </div>
                
              </div>
            )}
            
          </CardContent>
        </Card>
      </section>

      {/* --- Existing Market Overview --- */}
      <section id="market-overview">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {marketOverview.map((item) => (
            <Card
              key={item.label}
              className="card-glow border-border/50 hover:border-primary/30 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5"
            >
              <CardHeader className="pb-2">
                <CardDescription className="text-xs font-medium">
                  {item.label}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-end justify-between">
                  <span className="text-2xl font-bold tracking-tight font-mono">
                    {item.value}
                  </span>
                  <div
                    className={`flex items-center gap-1 text-sm font-semibold ${directionColor(item.direction)}`}
                  >
                    <DirectionIcon direction={item.direction} />
                    <span>{item.change}</span>
                  </div>
                </div>
                <div className="mt-1 flex justify-end">
                  <span
                    className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                      item.direction === "up"
                        ? "bg-stock-up/10 text-stock-up"
                        : item.direction === "down"
                          ? "bg-stock-down/10 text-stock-down"
                          : "bg-stock-flat/10 text-stock-flat"
                    }`}
                  >
                    {item.changePercent}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6">
        {/* Right Sidebar Cards */}
        <section className="space-y-6">
          {/* Quick Stats */}
          <Card className="border-border/50">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-chart-3" />
                <CardTitle className="text-lg">빠른 요약</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: "거래대금", value: "8.2조원" },
                { label: "시가총액", value: "2,145조원" },
                { label: "외국인 순매수", value: "+2,340억" },
                { label: "기관 순매수", value: "-1,230억" },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="flex items-center justify-between py-2 border-b border-border/30 last:border-none"
                >
                  <span className="text-sm text-muted-foreground">
                    {stat.label}
                  </span>
                  <span className="text-sm font-bold font-mono">
                    {stat.value}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
