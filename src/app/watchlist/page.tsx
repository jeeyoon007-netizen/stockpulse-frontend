"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchWatchlistDetailsAction } from "@/app/actions";
import { Star, TrendingUp, AlertTriangle, Info, ArrowRight, ShieldCheck, Zap, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";

interface WatchlistItem {
  stock_code: string;
  stock_name: string;
  backtest: {
    best_strategy_name: string;
    win_rate: number;
    total_return: number;
    mdd: number;
    trade_count: number;
  } | null;
  wyckoff: {
    phase: string | null;
    confidence: number | null;
  } | null;
}

export default function WatchlistPage() {
  const router = useRouter();
  const [nickname, setNickname] = useState<string | null>(null);
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadWatchlist = async (nick: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchWatchlistDetailsAction(nick);
      if (res.success && res.data) {
        setItems(res.data);
      } else {
        setError(res.error || "관심종목을 불러오는 중 오류가 발생했습니다.");
      }
    } catch (e: any) {
      setError(e.message || "관심종목을 불러오는 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  const promptNickname = () => {
    const input = window.prompt("관심 종목을 저장할 닉네임을 입력하세요 (최대 한글 5글자)\n※ 잊을 경우 복원할 수 없으니 주의하세요.");
    if (!input) {
      setIsLoading(false);
      return;
    }
    const sanitized = input.replace(/\s/g, '').toLowerCase().slice(0, 5);
    if (sanitized.length === 0) {
      setIsLoading(false);
      return;
    }
    
    localStorage.setItem("stockpulse_nickname", sanitized);
    setNickname(sanitized);
    loadWatchlist(sanitized);
  };

  const handleResetNickname = () => {
    if (window.confirm("현재 설정된 닉네임을 초기화하고 다시 설정하시겠습니까?")) {
      localStorage.removeItem("stockpulse_nickname");
      setNickname(null);
      setItems([]);
      promptNickname();
    }
  };

  useEffect(() => {
    const storedNickname = localStorage.getItem("stockpulse_nickname");
    if (storedNickname) {
      setNickname(storedNickname);
      loadWatchlist(storedNickname);
    } else {
      promptNickname();
    }
  }, []);

  const getWyckoffColor = (phase: string | null | undefined) => {
    if (!phase) return "bg-gray-500/10 text-gray-400 border-gray-500/20";
    switch (phase.toLowerCase()) {
      case "accumulation": return "bg-blue-500/10 text-blue-400 border-blue-500/20";
      case "markup": return "bg-green-500/10 text-green-400 border-green-500/20";
      case "distribution": return "bg-red-500/10 text-red-400 border-red-500/20";
      case "markdown": return "bg-orange-500/10 text-orange-400 border-orange-500/20";
      default: return "bg-gray-500/10 text-gray-400 border-gray-500/20";
    }
  };

  const getWyckoffIcon = (phase: string | null | undefined) => {
    if (!phase) return <Info className="w-4 h-4 mr-1" />;
    switch (phase.toLowerCase()) {
      case "accumulation": return <ShieldCheck className="w-4 h-4 mr-1" />;
      case "markup": return <TrendingUp className="w-4 h-4 mr-1" />;
      case "distribution": return <AlertTriangle className="w-4 h-4 mr-1" />;
      case "markdown": return <Activity className="w-4 h-4 mr-1" />;
      default: return <Info className="w-4 h-4 mr-1" />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
        <p className="text-muted-foreground animate-pulse">관심종목 데이터를 불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="container max-w-6xl py-10 space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-yellow-400 to-yellow-600 bg-clip-text text-transparent flex items-center gap-2">
            <Star className="w-8 h-8 fill-yellow-500 text-yellow-500" />
            나의 관심 종목
          </h1>
          <p className="text-muted-foreground">
            {nickname ? `'${nickname}' 님의 관심종목 리스트 - 와이코프 국면과 백테스트 AI 분석 결과를 한눈에 확인하세요.` : "닉네임을 설정하고 관심 종목을 추가해보세요"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {nickname ? (
            <Button variant="outline" size="sm" onClick={handleResetNickname}>
              닉네임 재설정
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={promptNickname}>
              닉네임 설정하기
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => router.push('/')}>
            시장 뷰로 돌아가기
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          {error}
        </div>
      )}

      {items.length === 0 && !error ? (
        <div className="flex flex-col items-center justify-center p-16 text-center border rounded-2xl bg-card/50 backdrop-blur-sm border-white/5">
          <Star className="w-16 h-16 text-muted-foreground/30 mb-4" />
          <h3 className="text-xl font-semibold mb-2">저장된 관심종목이 없습니다</h3>
          <p className="text-muted-foreground mb-6 max-w-md">
            종목 분석 페이지에서 별표 아이콘을 클릭하여 관심종목을 추가하면 이곳에서 전체적인 시장 국면과 전략을 추적할 수 있습니다.
          </p>
          <Button onClick={() => router.push('/')} className="bg-primary/20 hover:bg-primary/30 text-primary border-primary/50">
            종목 탐색하러 가기
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item) => (
            <div 
              key={item.stock_code} 
              className="group relative overflow-hidden rounded-2xl border border-white/10 bg-card/40 hover:bg-card/60 backdrop-blur-md transition-all duration-300 hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1 cursor-pointer flex flex-col"
              onClick={() => router.push(`/?q=${item.stock_code}`)}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              
              <div className="p-5 flex-1 flex flex-col gap-4 relative z-10">
                {/* Header: Name & Code */}
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-xl font-bold tracking-tight text-foreground">{item.stock_name}</h3>
                    <p className="text-sm text-muted-foreground">{item.stock_code}</p>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-medium border flex items-center ${getWyckoffColor(item.wyckoff?.phase)}`}>
                    {getWyckoffIcon(item.wyckoff?.phase)}
                    {item.wyckoff?.phase ? item.wyckoff.phase.toUpperCase() : "분석 대기"}
                    {item.wyckoff?.confidence && <span className="ml-1 opacity-70">({item.wyckoff.confidence}%)</span>}
                  </div>
                </div>

                {/* Backtest Section */}
                <div className="flex-1 bg-black/20 rounded-xl p-4 border border-white/5 flex flex-col justify-center">
                  {item.backtest ? (
                    <div className="space-y-3">
                      <div className="text-xs text-muted-foreground flex items-center justify-between">
                        <span className="flex items-center gap-1"><Zap className="w-3 h-3 text-yellow-500" /> AI 전략</span>
                        <span className="font-medium text-foreground truncate ml-2" title={item.backtest.best_strategy_name}>
                          {item.backtest.best_strategy_name}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/5">
                        <div className="flex flex-col">
                          <span className="text-[10px] text-muted-foreground uppercase">승률</span>
                          <span className={`text-sm font-bold ${item.backtest.win_rate >= 50 ? 'text-green-400' : 'text-red-400'}`}>
                            {item.backtest.win_rate.toFixed(1)}%
                          </span>
                        </div>
                        <div className="flex flex-col border-l border-white/5 pl-2">
                          <span className="text-[10px] text-muted-foreground uppercase">누적수익</span>
                          <span className={`text-sm font-bold ${item.backtest.total_return > 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {item.backtest.total_return > 0 ? '+' : ''}{item.backtest.total_return.toFixed(1)}%
                          </span>
                        </div>
                        <div className="flex flex-col border-l border-white/5 pl-2">
                          <span className="text-[10px] text-muted-foreground uppercase">MDD</span>
                          <span className="text-sm font-bold text-orange-400">
                            {item.backtest.mdd.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-4 flex flex-col items-center justify-center text-muted-foreground gap-2">
                      <Activity className="w-6 h-6 opacity-50" />
                      <span className="text-sm">백테스트 분석 중...</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="px-5 py-3 border-t border-white/5 bg-white/[0.02] flex justify-between items-center group-hover:bg-primary/10 transition-colors">
                <span className="text-xs font-medium text-muted-foreground group-hover:text-primary transition-colors">상세 분석 보기</span>
                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-transform group-hover:translate-x-1" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
