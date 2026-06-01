"use client";

import React, { useState } from "react";
import { type MarketFundsData, type CreditBalanceData } from "@/lib/api/kis-market";
import { TrendingUp, TrendingDown, Minus, Wallet, CreditCard, Activity, X, Bot } from "lucide-react";

interface Props {
  data: {
    funds: MarketFundsData | null;
    creditHistory: CreditBalanceData[];
    adrKospi: {
      adr: string;
      time: string;
      signal: string;
    } | null;
    adrKosdaq: {
      adr: string;
      time: string;
      signal: string;
    } | null;
    newHighCount?: number;
    newHighSectors?: { sector: string; count: number; stocks?: { name: string; code: string }[] }[];
    highTrend?: { date: string, count: number }[];
  };
  onAnalyze?: (code: string, name: string) => void;
}

export function CanaryCard({ data, onAnalyze }: Props) {
  const { funds, creditHistory, adrKospi, adrKosdaq, newHighCount = 0, newHighSectors = [], highTrend = [] } = data;
  const [activeSector, setActiveSector] = useState<{ sector: string; count: number; stocks?: { name: string; code: string }[] } | null>(null);
  const [confirmState, setConfirmState] = useState<{ x: number, y: number, code: string, name: string } | null>(null);
  
  // Format Large Money (KRW 억/조)
  const formatMoney = (val: number) => {
    if (val >= 10000) { 
        const jo = Math.floor(val / 10000);
        const eok = val % 10000;
        if (jo > 0) return `${jo}조 ${eok}억`;
        return `${eok}억`;
    }
    return `${val}억`;
  };

  const getTrendIcon = (curr: number, prev: number) => {
    if (curr > prev) return <TrendingUp className="w-3 h-3 text-stock-up" />;
    if (curr < prev) return <TrendingDown className="w-3 h-3 text-stock-down" />;
    return <Minus className="w-3 h-3 text-stock-flat" />;
  };

  // 신용잔고 전용: 증가 = 경고(주황), 감소 = 긍정(초록) — 방향 역전
  const getCreditTrendIcon = (curr: number, prev: number) => {
    if (curr > prev) return <TrendingUp className="w-3 h-3 text-amber-500" />;
    if (curr < prev) return <TrendingDown className="w-3 h-3 text-stock-up" />;
    return <Minus className="w-3 h-3 text-muted-foreground" />;
  };

  // YYYYMMDD -> M/D 포맷 도우미 (예: 20260526 -> 5/26)
  const formatDateLabel = (dateStr?: string) => {
    if (!dateStr || dateStr.length !== 8) return "";
    const month = parseInt(dateStr.substring(4, 6));
    const day = parseInt(dateStr.substring(6, 8));
    return `(${month}/${day} 기준)`;
  };

  // YYYY-MM-DD -> M/D 포맷 도우미 (예: 2026-05-27 (15:30) -> 5/27)
  const getCleanDate = (timeStr?: string) => {
    if (!timeStr) return "";
    const match = timeStr.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return `(${parseInt(match[2])}/${parseInt(match[3])} 기준)`;
    }
    return "";
  };

  const latestCredit = creditHistory[creditHistory.length - 1];
  const prevCredit = creditHistory[creditHistory.length - 2];

  // 전일 대비 증감률 기준 경고: +0.5% 초과 시 과열 경보
  const creditRatio = latestCredit?.ratio ?? 0;
  const isCreditIncreasing = latestCredit && prevCredit && latestCredit.amount >= prevCredit.amount;
  const isCreditAlert = isCreditIncreasing && creditRatio >= 0.5;

  const getSignalColor = (signal: string) => {
    if (signal.includes("매도")) return "text-stock-down";
    if (signal.includes("바닥")) return "text-stock-up";
    return "text-muted-foreground";
  };

  return (
    <div className="flex flex-col p-3 md:p-4 bg-background/40 rounded-xl border border-border/50 h-full hover:border-chart-3/30 transition-all">
      <div className="flex justify-between items-center mb-4 md:mb-6">
        <h3 className="text-xs md:text-sm font-medium text-muted-foreground flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-chart-3 animate-pulse"></span>
            카나리아 (시장 자금 & 심리)
        </h3>
        <span className="text-[9px] text-muted-foreground/80 font-mono bg-muted/30 border border-border/30 px-2 py-0.5 rounded shadow-sm">
            실시간 모니터링 중
        </span>
      </div>

      <div className="space-y-4">
        {/* Top Row Grid: Customer Deposit & Credit Balance */}
        <div className="grid grid-cols-2 gap-2 md:gap-3">
            {/* Deposit */}
            <div className="p-2.5 md:p-3 bg-muted/20 rounded-lg relative overflow-hidden group">
              <div className="flex items-center justify-between gap-1 mb-1">
                <div className="flex items-center gap-1.5">
                  <div className="p-1 bg-chart-1/10 rounded-md shrink-0">
                      <Wallet className="w-3.5 h-3.5 text-chart-1" />
                  </div>
                  <span className="text-[9px] md:text-[10px] text-muted-foreground font-bold">고객예탁금</span>
                </div>
                {funds?.date && (
                  <span className="text-[8px] text-muted-foreground font-mono opacity-80 shrink-0">
                    {formatDateLabel(funds.date)}
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-base md:text-lg font-black tracking-tighter font-mono">
                    {funds ? formatMoney(Math.round(funds.deposit / 100000000)) : "---"}
                </span>
                <span className="text-[8px] font-bold text-muted-foreground">원</span>
              </div>
            </div>

            {/* Credit Balance */}
            <div className={`p-2.5 md:p-3 rounded-lg relative overflow-hidden group transition-all ${
              isCreditAlert
                ? 'bg-amber-500/[0.06] border-l-2 border-amber-500/50'
                : 'bg-muted/20'
            }`}>
              {isCreditAlert && (
                <div className="absolute inset-0 bg-amber-500/5 animate-pulse pointer-events-none" />
              )}
              <div className="flex items-center justify-between gap-1 mb-1 relative z-10">
                <div className="flex items-center gap-1.5">
                  <div className={`p-1 rounded-md shrink-0 ${isCreditAlert ? 'bg-amber-500/20' : 'bg-chart-5/10'}`}>
                      <CreditCard className={`w-3.5 h-3.5 ${isCreditAlert ? 'text-amber-400' : 'text-chart-5'}`} />
                  </div>
                  <span className="text-[9px] md:text-[10px] text-muted-foreground font-bold">신용잔고</span>
                </div>
                {latestCredit?.date && (
                  <span className="text-[8px] text-muted-foreground font-mono opacity-80 shrink-0">
                    {formatDateLabel(latestCredit.date)}
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-1 relative z-10 flex-wrap">
                <span className="text-base md:text-lg font-black tracking-tighter font-mono">
                    {latestCredit ? (latestCredit.amount / 1000000000000).toFixed(1) : "---"}
                </span>
                <span className="text-[8px] font-bold text-muted-foreground">조원</span>
                {latestCredit && prevCredit && (
                  <div className="flex items-center gap-0.5 ml-auto shrink-0 bg-background/40 px-1 py-0.5 rounded border border-border/20">
                    {getCreditTrendIcon(latestCredit.amount, prevCredit.amount)}
                    <span className={`text-[8px] font-bold ${
                      latestCredit.amount >= prevCredit.amount ? 'text-amber-500' : 'text-stock-up'
                    }`}>
                        {latestCredit.ratio}%
                    </span>
                  </div>
                )}
              </div>
            </div>
        </div>

        {/* Middle Row: ADR (Advance Decline Ratio) */}
        <div className="p-2.5 md:p-3 bg-muted/20 rounded-lg relative overflow-hidden group">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-chart-2/10 rounded-md">
                <Activity className="w-4 h-4 text-chart-2" />
            </div>
            <span className="text-xs text-muted-foreground font-bold">ADR (등락비율)</span>
          </div>
          
          <div className="space-y-3">
            {/* KOSPI ADR */}
            <div className="flex flex-col gap-0.5 border-b border-border/20 pb-2">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-muted-foreground">KOSPI</span>
                <span className="text-[8px] text-muted-foreground font-mono">{adrKospi?.time || "---"}</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-sm md:text-base font-black tracking-tighter font-mono">
                  {adrKospi ? Number(adrKospi.adr).toFixed(2) : "---"}%
                </span>
                <span className={`text-[9px] font-bold ${getSignalColor(adrKospi?.signal || "")}`}>
                  {adrKospi?.signal || "---"}
                </span>
              </div>
            </div>

            {/* KOSDAQ ADR */}
            <div className="flex flex-col gap-0.5">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-muted-foreground">KOSDAQ</span>
                <span className="text-[8px] text-muted-foreground font-mono">{adrKosdaq?.time || "---"}</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-sm md:text-base font-black tracking-tighter font-mono">
                  {adrKosdaq ? Number(adrKosdaq.adr).toFixed(2) : "---"}%
                </span>
                <span className={`text-[9px] font-bold ${getSignalColor(adrKosdaq?.signal || "")}`}>
                  {adrKosdaq?.signal || "---"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 52-Week High (52주 신고가) - Moved below ADR */}
        <div 
          className={`p-2.5 md:p-3 bg-muted/20 rounded-lg relative overflow-hidden group border-l-2 border-stock-up/30 transition-all select-none ${
            newHighCount >= 50 
              ? "shadow-[0_0_12px_rgba(244,63,94,0.15)] border-stock-up/50 bg-stock-up/[0.04]" 
              : newHighCount >= 20 
              ? "shadow-[0_0_8px_rgba(244,63,94,0.08)] border-stock-up/40 bg-stock-up/[0.02]" 
              : ""
          }`}
        >
          {/* Subtle background pulse glow if count is high */}
          {newHighCount >= 20 && (
            <div className="absolute inset-0 bg-stock-up/5 animate-pulse pointer-events-none opacity-45" />
          )}
          
          <div className="flex items-center justify-between mb-2 relative z-10 gap-1">
            <div className="flex items-center gap-1.5">
              <div className={`p-1 rounded-md shrink-0 ${newHighCount >= 20 ? 'bg-stock-up/20' : 'bg-stock-up/10'}`}>
                  <TrendingUp className={`w-3.5 h-3.5 text-stock-up ${newHighCount >= 20 ? 'animate-bounce' : ''}`} />
              </div>
              <span className="text-[9px] md:text-[10px] text-muted-foreground font-bold">52주 신고가 종목 및 업종 분포</span>
            </div>
            {adrKospi?.time && (
              <span className="text-[8px] text-muted-foreground font-mono opacity-80 shrink-0">
                {getCleanDate(adrKospi.time)}
              </span>
            )}
          </div>
          
          <div className="flex items-baseline gap-1 relative z-10 mb-3 flex-wrap font-mono">
            <span className="text-base md:text-lg font-black text-zinc-100 tracking-tighter">
              🏆 {newHighCount}
            </span>
            <span className="text-[10px] font-bold text-zinc-400 ml-0.5">종목 달성</span>
            <span className="text-[9px] text-zinc-500 font-bold whitespace-nowrap ml-2 font-sans">
              ({newHighCount >= 50 
                ? "🔥 극도로 강한 수급" 
                : newHighCount >= 20 
                ? "✨ 시장 활성화 국면" 
                : "일부 주도주 중심 견인"})
            </span>
          </div>

          {/* 주요 강세 업종 추가 (제한 없이 전체 표시) */}
          {newHighSectors.length > 0 && (
            <div className="pt-2 border-t border-border/30 relative z-10 space-y-1.5">
              <span className="text-[9px] font-bold text-muted-foreground/80 block uppercase tracking-wider font-sans">업종별 신고가 분포</span>
              <div className="flex flex-wrap gap-1.5 max-h-[300px] overflow-y-auto pr-1">
                {newHighSectors.map((s, idx) => {
                  const isOpened = activeSector?.sector === s.sector;
                  return (
                    <React.Fragment key={idx}>
                      <span 
                        className={`text-[9px] font-bold px-2 py-1 rounded-md active:scale-95 border flex items-center gap-1.5 cursor-pointer transition-all leading-none shadow-sm select-none ${
                          isOpened 
                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50" 
                            : "bg-zinc-800/85 hover:bg-zinc-750 border-zinc-700/40 text-zinc-200 hover:border-zinc-500"
                        }`}
                        title={`${s.sector} (${s.count}종목)`}
                        onClick={() => {
                          if (isOpened) {
                            setActiveSector(null);
                          } else {
                            setActiveSector(s);
                          }
                        }}
                      >
                        <span>{s.sector}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-black font-mono border ${
                          isOpened 
                            ? "bg-emerald-500/30 text-emerald-200 border-emerald-500/40" 
                            : "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                        }`}>{s.count}</span>
                      </span>
                      
                      {/* 클릭 시 아래 행에 강제 전개되는 100% 폭의 종목 리스트 박스 */}
                      {isOpened && (
                        <div className="w-full flex-shrink-0 flex-grow-0 my-1.5 px-3 py-2.5 bg-zinc-900/60 border border-zinc-850 hover:border-zinc-800 rounded-xl animate-in slide-in-from-top-1.5 duration-200 relative z-20">
                          <div className="flex items-center gap-1.5 mb-2 pb-1.5 border-b border-border/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            <span className="text-[9px] font-black text-zinc-300">{s.sector} 강세 주도주 목록</span>
                          </div>
                          {s.stocks && s.stocks.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                              {s.stocks.map((stock, sIdx) => (
                                <span 
                                  key={`${stock.code}-${sIdx}`}
                                  onClick={(e) => {
                                    setConfirmState({ x: e.clientX, y: e.clientY, code: stock.code, name: stock.name });
                                  }}
                                  className="px-2 py-1 text-[9px] font-bold bg-zinc-800/60 border border-zinc-700/30 hover:border-yellow-500/50 hover:text-yellow-400 active:scale-95 rounded-md cursor-pointer transition-all select-none group flex items-center gap-1"
                                >
                                  <span>{stock.name}</span>
                                  <span className="text-[7.5px] font-bold font-mono text-zinc-500 group-hover:text-zinc-400 transition-colors px-1 py-0.2 bg-zinc-950/80 border border-zinc-850/50 rounded">
                                    {stock.code}
                                  </span>
                                </span>
                              ))}
                            </div>
                          ) : (
                            <div className="text-[8.5px] text-muted-foreground italic py-1">
                              해당 업종에 소속된 신고가 종목 데이터가 없습니다.
                            </div>
                          )}
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Row: New High Trend Mini Chart */}
        <div className="pt-2">
            <span className="text-[9px] text-muted-foreground font-bold mb-2 block uppercase tracking-wider">신고가 영업일 5일간 추이</span>
            <div className="flex items-end justify-between gap-1.5 md:gap-2 h-10 md:h-12 px-1">
                {highTrend.map((h, i) => {
                    const max = Math.max(...highTrend.map(x => x.count), 1);
                    const height = (h.count / max) * 100;
                    return (
                        <div key={i} className="flex flex-col items-center flex-1 gap-1 group">
                            <div 
                                className={`w-full rounded-t-sm transition-all duration-300 ${i === highTrend.length - 1 ? 'bg-stock-up shadow-[0_0_8px_rgba(239,68,68,0.4)]' : 'bg-stock-up/30 group-hover:bg-stock-up/50'}`} 
                                style={{ height: `${Math.max(10, height)}%` }}
                            ></div>
                            <span className="text-[7px] text-muted-foreground font-mono">{h.date}</span>
                        </div>
                    );
                })}
            </div>
        </div>
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
                  setActiveSector(null); // 모달도 닫기
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
                  setActiveSector(null); // 모달도 닫기
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
