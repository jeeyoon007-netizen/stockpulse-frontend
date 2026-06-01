"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { History, Search, X, Star, AlertCircle } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BacktestBadge } from "@/components/ui/backtest-badge";

interface WatchlistItem {
  stock_code: string;
  stock_name: string;
}

export default function HistoryPage() {
  const [nickname, setNickname] = useState<string | null>(null);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [searchFilter, setSearchFilter] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [stocks, setStocks] = useState<{code: string, name: string}[]>([]);

  useEffect(() => {
    // 종목 마스터 JSON 로드
    fetch("/stocks.json")
      .then(res => res.json())
      .then(data => setStocks(data))
      .catch(err => console.error("stocks.json 로드 실패:", err));

    const storedNickname = localStorage.getItem("stockpulse_nickname");
    if (storedNickname) {
      setNickname(storedNickname);
      fetchWatchlist(storedNickname);
    } else {
      promptNickname();
    }
  }, []);

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
    fetchWatchlist(sanitized);
  };

  const fetchWatchlist = async (nick: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080"}/api/v1/watchlist/list?nickname=${encodeURIComponent(nick)}`);
      const json = await res.json();
      if (json.success) {
        setWatchlist(json.data);
      }
    } catch (e) {
      console.error("Failed to fetch watchlist", e);
    } finally {
      setIsLoading(false);
    }
  };

  const getDisplayStockName = (item: WatchlistItem) => {
    if (item.stock_name && item.stock_name !== "검색된 종목") {
      return item.stock_name;
    }
    const match = stocks.find(s => s.code === item.stock_code);
    return match ? match.name : (item.stock_name || "검색된 종목");
  };

  const filteredList = watchlist.filter((item) =>
    getDisplayStockName(item).toLowerCase().includes(searchFilter.toLowerCase()) || 
    item.stock_code.includes(searchFilter)
  );

  const removeItem = async (stockCode: string) => {
    if (!nickname) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080"}/api/v1/watchlist/remove`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname, stock_code: stockCode })
      });
      const json = await res.json();
      if (json.success) {
        setWatchlist((prev) => prev.filter((item) => item.stock_code !== stockCode));
      }
    } catch (e) {
      alert("삭제 중 오류가 발생했습니다.");
    }
  };

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-[1200px] mx-auto">
      {/* Page Header */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Star className="w-6 h-6 text-yellow-500 fill-yellow-500" />
            나의 관심 종목
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {nickname ? `'${nickname}' 님의 백테스트 관심 리스트` : "닉네임을 설정하고 관심 종목을 추가해보세요"}
          </p>
        </div>
        {!nickname && (
          <Button variant="outline" size="sm" onClick={promptNickname}>
            닉네임 설정하기
          </Button>
        )}
      </header>

      {/* Search Filter */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="관심 종목 내 검색..."
          value={searchFilter}
          onChange={(e) => setSearchFilter(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-secondary/50 border border-border/50 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all"
        />
      </div>

      {/* Loading State */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mb-4"></div>
          <p>불러오는 중...</p>
        </div>
      ) : filteredList.length > 0 ? (
        <div className="space-y-3">
          {filteredList.map((item) => (
            <Card
              key={item.stock_code}
              className="border-border/50 hover:border-primary/20 transition-all duration-200 hover:shadow-md hover:shadow-primary/5 group"
            >
              <CardContent className="py-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <Link 
                        href={`/?code=${item.stock_code}`}
                        className="font-semibold text-lg group-hover:text-primary transition-colors hover:underline cursor-pointer"
                      >
                        {getDisplayStockName(item)}
                      </Link>
                      <span className="text-xs text-muted-foreground font-mono bg-secondary/50 px-1.5 py-0.5 rounded">
                        {item.stock_code}
                      </span>
                    </div>
                    {/* 백테스트 뱃지 컴포넌트 추가 */}
                    <BacktestBadge stockCode={item.stock_code} />
                  </div>
                  
                  <div className="flex items-center self-end sm:self-center gap-4">
                    <button
                      onClick={() => removeItem(item.stock_code)}
                      className="opacity-0 group-hover:opacity-100 p-2 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all duration-200"
                      aria-label={`${getDisplayStockName(item)} 삭제`}
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-border/50 border-dashed">
          <CardContent className="py-16 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-full bg-secondary/50 flex items-center justify-center mb-4">
              <Star className="w-7 h-7 text-muted-foreground" />
            </div>
            <CardTitle className="text-base text-muted-foreground mb-1">
              {searchFilter ? "검색 결과 없음" : "관심 종목이 없습니다"}
            </CardTitle>
            <CardDescription className="text-sm">
              {searchFilter
                ? `"${searchFilter}"와 일치하는 종목이 없습니다`
                : "검색 페이지에서 관심 종목을 추가하면 매일 백테스트가 자동으로 실행됩니다"}
            </CardDescription>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
