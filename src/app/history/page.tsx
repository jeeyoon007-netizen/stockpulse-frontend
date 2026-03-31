"use client";

import { useState } from "react";
import { History, Search, X, Clock, ArrowUpRight } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// 더미 검색 기록 데이터
const initialHistory = [
  {
    id: 1,
    query: "삼성전자",
    code: "005930",
    timestamp: "2026-03-31 19:30",
    price: "71,800",
    direction: "up" as const,
  },
  {
    id: 2,
    query: "SK하이닉스",
    code: "000660",
    timestamp: "2026-03-31 19:25",
    price: "178,500",
    direction: "down" as const,
  },
  {
    id: 3,
    query: "NAVER",
    code: "035420",
    timestamp: "2026-03-31 18:50",
    price: "214,000",
    direction: "up" as const,
  },
  {
    id: 4,
    query: "카카오",
    code: "035720",
    timestamp: "2026-03-31 18:42",
    price: "48,950",
    direction: "flat" as const,
  },
  {
    id: 5,
    query: "현대자동차",
    code: "005380",
    timestamp: "2026-03-31 17:30",
    price: "235,500",
    direction: "down" as const,
  },
  {
    id: 6,
    query: "LG에너지솔루션",
    code: "373220",
    timestamp: "2026-03-31 16:15",
    price: "382,000",
    direction: "up" as const,
  },
];

function directionColor(direction: "up" | "down" | "flat") {
  if (direction === "up") return "text-stock-up";
  if (direction === "down") return "text-stock-down";
  return "text-stock-flat";
}

function directionBg(direction: "up" | "down" | "flat") {
  if (direction === "up") return "bg-stock-up/10";
  if (direction === "down") return "bg-stock-down/10";
  return "bg-stock-flat/10";
}

export default function HistoryPage() {
  const [history, setHistory] = useState(initialHistory);
  const [searchFilter, setSearchFilter] = useState("");

  const filteredHistory = history.filter((item) =>
    item.query.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const removeItem = (id: number) => {
    setHistory((prev) => prev.filter((item) => item.id !== id));
  };

  const clearAll = () => {
    setHistory([]);
  };

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-[1200px] mx-auto">
      {/* Page Header */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <History className="w-6 h-6 text-primary" />
            검색 기록
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            최근 검색한 종목을 확인하세요
          </p>
        </div>
        {history.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={clearAll}
            className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
            id="clear-history-btn"
          >
            <X className="w-4 h-4 mr-1" />
            전체 삭제
          </Button>
        )}
      </header>

      {/* Search Filter */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="기록 검색..."
          value={searchFilter}
          onChange={(e) => setSearchFilter(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-secondary/50 border border-border/50 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all"
          id="history-search-input"
        />
      </div>

      {/* History List */}
      {filteredHistory.length > 0 ? (
        <div className="space-y-3">
          {filteredHistory.map((item) => (
            <Card
              key={item.id}
              className="border-border/50 hover:border-primary/20 transition-all duration-200 hover:shadow-md hover:shadow-primary/5 group"
            >
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-10 h-10 rounded-lg ${directionBg(item.direction)} flex items-center justify-center`}
                    >
                      <ArrowUpRight
                        className={`w-5 h-5 ${directionColor(item.direction)} ${
                          item.direction === "down" ? "rotate-90" : ""
                        } ${item.direction === "flat" ? "rotate-45" : ""}`}
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm group-hover:text-primary transition-colors">
                          {item.query}
                        </span>
                        <span className="text-[11px] text-muted-foreground font-mono bg-secondary/50 px-1.5 py-0.5 rounded">
                          {item.code}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        <span>{item.timestamp}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span
                        className={`text-sm font-bold font-mono ${directionColor(item.direction)}`}
                      >
                        ₩{item.price}
                      </span>
                    </div>
                    <button
                      onClick={() => removeItem(item.id)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all duration-200"
                      aria-label={`${item.query} 기록 삭제`}
                    >
                      <X className="w-4 h-4" />
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
              <Search className="w-7 h-7 text-muted-foreground" />
            </div>
            <CardTitle className="text-base text-muted-foreground mb-1">
              {searchFilter ? "검색 결과 없음" : "검색 기록이 없습니다"}
            </CardTitle>
            <CardDescription className="text-sm">
              {searchFilter
                ? `"${searchFilter}"와 일치하는 기록이 없습니다`
                : "종목을 검색하면 여기에 기록이 표시됩니다"}
            </CardDescription>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
