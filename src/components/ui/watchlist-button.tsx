"use client";

import { useState, useEffect } from "react";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";

interface WatchlistButtonProps {
  stockCode: string;
  stockName: string;
}

export function WatchlistButton({ stockCode, stockName }: WatchlistButtonProps) {
  const [isWatched, setIsWatched] = useState(false);
  const [nickname, setNickname] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Check if nickname exists in localStorage
    const storedNickname = localStorage.getItem("stockpulse_nickname");
    if (storedNickname) {
      setNickname(storedNickname);
      checkIsWatched(storedNickname);
    }
  }, [stockCode]);

  const checkIsWatched = async (nick: string) => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080"}/api/v1/watchlist/list?nickname=${encodeURIComponent(nick)}`);
      const json = await res.json();
      if (json.success && json.data) {
        const found = json.data.some((item: any) => item.stock_code === stockCode);
        setIsWatched(found);
      }
    } catch (e) {
      console.error("Failed to check watchlist status", e);
    }
  };

  const handleToggle = async () => {
    let currentNick = nickname;
    if (!currentNick) {
      const input = window.prompt("관심 종목을 저장할 닉네임을 입력하세요 (최대 한글 5글자)\n※ 잊을 경우 복원 불가");
      if (!input) return;
      
      const sanitized = input.replace(/\s/g, '').toLowerCase().slice(0, 5);
      if (sanitized.length === 0) return;
      
      localStorage.setItem("stockpulse_nickname", sanitized);
      setNickname(sanitized);
      currentNick = sanitized;
    }

    setIsLoading(true);
    const endpoint = isWatched ? '/api/v1/watchlist/remove' : '/api/v1/watchlist/add';
    
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080"}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname: currentNick,
          stock_code: stockCode,
          stock_name: stockName
        })
      });
      const json = await res.json();
      if (json.success) {
        setIsWatched(!isWatched);
      } else {
        alert("처리 중 오류가 발생했습니다: " + json.error);
      }
    } catch (e) {
      alert("네트워크 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      className={`gap-2 ${isWatched ? 'text-yellow-500 border-yellow-500/50 bg-yellow-500/10 hover:bg-yellow-500/20' : 'text-muted-foreground hover:text-foreground'}`}
      onClick={handleToggle}
      disabled={isLoading}
    >
      <Star className={`w-4 h-4 ${isWatched ? 'fill-yellow-500' : ''}`} />
      {isWatched ? '관심종목' : '관심 추가'}
    </Button>
  );
}
