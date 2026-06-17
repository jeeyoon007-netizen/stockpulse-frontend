"use client";

import React, { useState } from "react";
import { type MarketFundsData, type CreditBalanceData } from "@/lib/api/kis-market";
import { TrendingUp, TrendingDown, Minus, Wallet, CreditCard, Activity, X, Bot, AlertTriangle, AlertCircle, ShieldAlert } from "lucide-react";

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
    creditDepositRatio?: number;
    creditMarketCapRatio?: number;
    macroAnalysis?: any;
  };
  marketOverview: any[];
  onAnalyze?: (code: string, name: string) => void;
}

export function CanaryCard({ data, marketOverview, onAnalyze }: Props) {
  const { funds, creditHistory, adrKospi, adrKosdaq } = data;
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

  const cdRatio = data.creditDepositRatio || 0;
  const cmRatio = data.creditMarketCapRatio || 0;

  // Thresholds Check
  const getLevel = (val: number, type: 'CD' | 'CM') => {
    if (type === 'CD') {
      if (val >= 90) return { level: '위험', color: 'bg-red-500', bgClass: 'bg-red-500/10', borderClass: 'border-red-500/20', textColor: 'text-red-500', alert: '🔴 위험: 강제청산 연쇄 우려' };
      if (val >= 75) return { level: '경고', color: 'bg-orange-500', bgClass: 'bg-orange-500/10', borderClass: 'border-orange-500/20', textColor: 'text-orange-500', alert: '🟠 경고: 반대매매 연쇄 위험' };
      if (val >= 60) return { level: '주의', color: 'bg-yellow-500', bgClass: 'bg-yellow-500/10', borderClass: 'border-yellow-500/20', textColor: 'text-yellow-500', alert: '🟡 주의: 레버리지 누적 시작' };
      return { level: '정상', color: 'bg-emerald-500', bgClass: 'bg-emerald-500/10', borderClass: 'border-emerald-500/20', textColor: 'text-emerald-500', alert: '🟢 정상: 레버리지 비율 안정' };
    } else {
      if (val >= 1.6) return { level: '위험', color: 'bg-red-500', bgClass: 'bg-red-500/10', borderClass: 'border-red-500/20', textColor: 'text-red-500', alert: '🔴 위험: 신용 비중 극단' };
      if (val >= 1.3) return { level: '경고', color: 'bg-orange-500', bgClass: 'bg-orange-500/10', borderClass: 'border-orange-500/20', textColor: 'text-orange-500', alert: '🟠 경고: 하방 시 투매 우려' };
      if (val >= 1.0) return { level: '주의', color: 'bg-yellow-500', bgClass: 'bg-yellow-500/10', borderClass: 'border-yellow-500/20', textColor: 'text-yellow-500', alert: '🟡 주의: 신용 경계 수준' };
      return { level: '정상', color: 'bg-emerald-500', bgClass: 'bg-emerald-500/10', borderClass: 'border-emerald-500/20', textColor: 'text-emerald-500', alert: '🟢 정상: 시총 대비 신용 안정' };
    }
  };

  const cdStatus = getLevel(cdRatio, 'CD');
  const cmStatus = getLevel(cmRatio, 'CM');

  // 방향 괴리 감지 로직
  const kospi = marketOverview.find((m: any) => m.label === "코스피");
  const isMarketUp = kospi && (kospi.direction === "up" || kospi.direction === "상승");
  const isMarketDown = kospi && (kospi.direction === "down" || kospi.direction === "하락");
  
  const macro = data.macroAnalysis || {
    consecutiveDepositDecline: 0,
    consecutiveCreditIncrease: 0,
    creditMinMax: 0,
    creditPercentile: 0,
  };

  const depDown = macro.consecutiveDepositDecline;
  const credUp = macro.consecutiveCreditIncrease;

  let gapAnalysis = {
    title: "지수 vs 증시자금 괴리 분석",
    statusTitle: "⚪ 중립: 자금 추이 모니터링",
    description: "장세에 따른 자금 이탈 모니터링 중입니다.",
    condition: "특이 이벤트 없음 (예탁금 2일 미만 감소 or 지수 보합/하락세이나 예탁금 감소 없음)",
    status: "정상", // '정상', '주의', '경고', '위험'
    color: "text-muted-foreground",
    bgColor: "bg-muted/10",
    borderColor: "border-border/30",
    icon: TrendingUp
  };

  if (depDown >= 3 && credUp >= 1) {
    gapAnalysis = {
      title: "지수 vs 증시자금 괴리 분석",
      statusTitle: "🔴 위험: 최악의 자금 괴리",
      description: `현금(예탁금)은 ${depDown}일 연속 하락하는데 빚(신용)은 증가 중입니다. 레버리지 청산 압력이 매우 큽니다.`,
      condition: "예탁금 3일 이상 연속 하락 & 신용잔고 1일 이상 연속 상승",
      status: "위험",
      color: "text-red-500",
      bgColor: "bg-red-500/5",
      borderColor: "border-red-500/30",
      icon: ShieldAlert
    };
  } else if (depDown >= 5) {
    gapAnalysis = {
      title: "지수 vs 증시자금 괴리 분석",
      statusTitle: "🔴 위험: 강력한 자금 이탈",
      description: `예탁금이 ${depDown}일 연속 하락 중입니다. 시장 방향과 무관하게 투자 자금 이탈이 뚜렷합니다.`,
      condition: "예탁금 5일 이상 연속 하락",
      status: "위험",
      color: "text-red-500",
      bgColor: "bg-red-500/5",
      borderColor: "border-red-500/30",
      icon: ShieldAlert
    };
  } else if (depDown >= 3 && isMarketDown) {
    gapAnalysis = {
      title: "지수 vs 증시자금 괴리 분석",
      statusTitle: "🟠 경고: 투자심리 위축",
      description: `지수 하락과 함께 예탁금도 ${depDown}일 연속 하락 중입니다. 시장 분위기가 차갑게 위축되었습니다.`,
      condition: "예탁금 3일 이상 연속 하락 & 코스피 지수 하락세",
      status: "경고",
      color: "text-orange-500",
      bgColor: "bg-orange-500/5",
      borderColor: "border-orange-500/30",
      icon: AlertTriangle
    };
  } else if (depDown >= 3 && isMarketUp) {
    gapAnalysis = {
      title: "지수 vs 증시자금 괴리 분석",
      statusTitle: "🟠 경고: 투자자 이탈 신호",
      description: `지수는 상승 중이나 예탁금은 ${depDown}일 연속 하락했습니다. 겉보기와 달리 실질 자금이 유출 중입니다.`,
      condition: "예탁금 3일 이상 연속 하락 & 코스피 지수 상승세",
      status: "경고",
      color: "text-orange-500",
      bgColor: "bg-orange-500/5",
      borderColor: "border-orange-500/30",
      icon: AlertTriangle
    };
  } else if (depDown >= 2 && isMarketUp) {
    gapAnalysis = {
      title: "지수 vs 증시자금 괴리 분석",
      statusTitle: "🟡 주의: 자금 이탈 초기",
      description: `지수 상승에도 불구하고 예탁금이 2일 연속 하락했습니다. 수급 유출 흐름에 유의하세요.`,
      condition: "예탁금 2일 연속 하락 & 코스피 지수 상승세",
      status: "주의",
      color: "text-yellow-500",
      bgColor: "bg-yellow-500/5",
      borderColor: "border-yellow-500/30",
      icon: AlertCircle
    };
  } else if (isMarketUp) {
    gapAnalysis = {
      title: "지수 vs 증시자금 괴리 분석",
      statusTitle: "🟢 정상: 선순환 흐름",
      description: "지수가 상승하며 시장 자금이 정상적인 선순환 흐름을 보이고 있습니다.",
      condition: "위의 모든 부정적 이탈 조건(연속 예탁금 감소)에 해당하지 않고, 지수가 상승세일 때",
      status: "정상",
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/5",
      borderColor: "border-emerald-500/30",
      icon: TrendingUp
    };
  }

  return (
    <div className="flex flex-col p-3 md:p-4 bg-background/40 rounded-xl border border-border/50 h-full hover:border-chart-3/30 transition-all min-w-0">
      <div className="flex justify-between items-center mb-4 md:mb-6">
        <h3 className="text-xs md:text-sm font-extrabold text-foreground tracking-tight flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse shadow-[0_0_8px_rgba(249,115,22,0.8)]"></span>
            카나리아 (시장 자금 & 심리)
        </h3>
        <span className="text-[10px] text-muted-foreground/90 font-mono bg-muted/40 border border-border/40 px-2 py-0.5 rounded shadow-sm font-bold">
            실시간 모니터링 중
        </span>
      </div>

      <div className="space-y-4">
        {/* Top Row Grid: Customer Deposit & Credit Balance */}
        <div className="grid grid-cols-2 gap-2 md:gap-3">
            {/* Deposit */}
            <div className="p-3 md:p-3.5 bg-muted/20 rounded-lg relative overflow-hidden group border border-border/20 shadow-sm">
              <div className="flex items-center justify-between gap-1 mb-1.5">
                <div className="flex items-center gap-1.5">
                  <div className="p-1 bg-chart-1/10 rounded-md shrink-0">
                      <Wallet className="w-4 h-4 text-chart-1" />
                  </div>
                  <span className="text-[10px] md:text-xs text-foreground/90 font-extrabold">고객예탁금</span>
                </div>
                {funds?.date && (
                  <span className="text-[9px] text-muted-foreground/80 font-mono font-bold shrink-0">
                    {formatDateLabel(funds.date)}
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-sm md:text-base font-black tracking-tighter font-mono text-foreground">
                    {funds ? formatMoney(Math.round(funds.deposit / 100000000)) : "---"}
                </span>
                <span className="text-[10px] font-black text-muted-foreground/90">원</span>
              </div>
            </div>

            {/* Credit Balance */}
            <div className={`p-3 md:p-3.5 rounded-lg relative overflow-hidden group transition-all border shadow-sm ${
              isCreditAlert
                ? 'bg-amber-500/[0.06] border-amber-500/50 border-l-2'
                : 'bg-muted/20 border-border/20'
            }`}>
              {isCreditAlert && (
                <div className="absolute inset-0 bg-amber-500/5 animate-pulse pointer-events-none" />
              )}
              <div className="flex items-center justify-between gap-1 mb-1.5 relative z-10">
                <div className="flex items-center gap-1.5">
                  <div className={`p-1 rounded-md shrink-0 ${isCreditAlert ? 'bg-amber-500/20' : 'bg-chart-5/10'}`}>
                      <CreditCard className={`w-4 h-4 ${isCreditAlert ? 'text-amber-400' : 'text-chart-5'}`} />
                  </div>
                  <span className="text-[10px] md:text-xs text-foreground/90 font-extrabold">신용잔고</span>
                </div>
                {latestCredit?.date && (
                  <span className="text-[9px] text-muted-foreground/80 font-mono font-bold shrink-0">
                    {formatDateLabel(latestCredit.date)}
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-1 relative z-10 flex-wrap">
                <span className="text-sm md:text-base font-black tracking-tighter font-mono text-foreground">
                    {latestCredit ? (latestCredit.amount / 1000000000000).toFixed(1) : "---"}
                </span>
                <span className="text-[10px] font-black text-muted-foreground/90">조원</span>
                {latestCredit && prevCredit && (
                  <div className="flex items-center gap-0.5 ml-auto shrink-0 bg-background/40 px-1 py-0.5 rounded border border-border/20">
                    {getCreditTrendIcon(latestCredit.amount, prevCredit.amount)}
                    <span className={`text-[9px] font-black ${
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
        <div className="p-3 md:p-4 bg-muted/20 rounded-lg relative overflow-hidden group border border-border/20 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-chart-2/10 rounded-md">
                <Activity className="w-4 h-4 text-chart-2" />
            </div>
            <span className="text-xs md:text-sm text-foreground font-extrabold tracking-tight">ADR (등락비율)</span>
          </div>
          
          <div className="space-y-4">
            {/* KOSPI ADR */}
            <div className="flex flex-col gap-1 border-b border-border/20 pb-3">
              <div className="flex justify-between items-center">
                <span className="text-[11px] md:text-xs font-extrabold text-foreground/80">KOSPI</span>
                <span className="text-[9px] md:text-[10px] text-muted-foreground/80 font-mono font-bold">{adrKospi?.time || "---"}</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-sm md:text-base font-black tracking-tighter font-mono text-foreground">
                  {adrKospi ? Number(adrKospi.adr).toFixed(2) : "---"}%
                </span>
                <span className={`text-[10.5px] md:text-xs font-black ${getSignalColor(adrKospi?.signal || "")}`}>
                  {adrKospi?.signal || "---"}
                </span>
              </div>
            </div>

            {/* KOSDAQ ADR */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-center">
                <span className="text-[11px] md:text-xs font-extrabold text-foreground/80">KOSDAQ</span>
                <span className="text-[9px] md:text-[10px] text-muted-foreground/80 font-mono font-bold">{adrKosdaq?.time || "---"}</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-sm md:text-base font-black tracking-tighter font-mono text-foreground">
                  {adrKosdaq ? Number(adrKosdaq.adr).toFixed(2) : "---"}%
                </span>
                <span className={`text-[10.5px] md:text-xs font-black ${getSignalColor(adrKosdaq?.signal || "")}`}>
                  {adrKosdaq?.signal || "---"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Leverage & Macro Risk Monitor Box (통합된 매크로 모니터) */}
        <div className="pt-3 border-t border-border/20 space-y-4 relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-chart-4/10 rounded-md shrink-0">
              <Activity className="w-4 h-4 text-chart-4" />
            </div>
            <span className="text-xs md:text-sm text-foreground font-extrabold tracking-tight">시장 레버리지 & 자금동향 모니터</span>
          </div>

          {/* Ratios Stacked (한 줄에 한 항목씩) */}
          <div className="flex flex-col space-y-3">
            {/* CD Ratio */}
            <div className="space-y-2.5 p-3 bg-muted/10 rounded-lg border border-border/20 shadow-sm hover:border-chart-4/20 transition-all">
              <div className="flex justify-between items-center text-xs md:text-sm font-bold text-muted-foreground">
                <span>신용 / 예탁금 비율</span>
                <span className={`font-mono text-sm md:text-base font-black ${cdStatus.textColor}`}>{cdRatio > 0 ? cdRatio.toFixed(1) : "0.0"}%</span>
              </div>
              <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden border border-zinc-700/20">
                <div className={`h-full rounded-full ${cdStatus.color}`} style={{ width: `${Math.min(cdRatio, 100)}%` }} />
              </div>
              <span className={`text-[11px] md:text-xs font-bold block leading-normal ${cdStatus.textColor}`}>{cdStatus.alert}</span>
            </div>

            {/* CM Ratio */}
            <div className="space-y-2.5 p-3 bg-muted/10 rounded-lg border border-border/20 shadow-sm hover:border-chart-4/20 transition-all">
              <div className="flex justify-between items-center text-xs md:text-sm font-bold text-muted-foreground">
                <span>신용 / 시가총액 비율</span>
                <span className={`font-mono text-sm md:text-base font-black ${cmStatus.textColor}`}>{cmRatio > 0 ? cmRatio.toFixed(2) : "0.00"}%</span>
              </div>
              <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden border border-zinc-700/20">
                <div className={`h-full rounded-full ${cmStatus.color}`} style={{ width: `${Math.min((cmRatio / 2) * 100, 100)}%` }} />
              </div>
              <span className={`text-[11px] md:text-xs font-bold block leading-normal ${cmStatus.textColor}`}>{cmStatus.alert}</span>
            </div>
          </div>

          {/* Gap Analysis Box */}
          <div className={`rounded-xl p-3 md:p-4 border shadow-md transition-all ${gapAnalysis.borderColor} ${gapAnalysis.bgColor}`}>
            {/* Box Header - clearly recognized as a Title */}
            <div className="flex items-center gap-2 pb-2.5 mb-2.5 border-b border-border/30">
              <gapAnalysis.icon className={`w-4 h-4 ${gapAnalysis.color}`} />
              <span className={`text-xs md:text-sm font-extrabold tracking-tight ${gapAnalysis.color}`}>
                {gapAnalysis.title}
              </span>
            </div>

            {/* Status Display */}
            <div className="flex items-center gap-1.5 mt-2">
              <span className="text-xs md:text-sm font-extrabold text-foreground">
                {gapAnalysis.statusTitle}
              </span>
            </div>

            {/* Description */}
            <p className="text-[11px] md:text-xs font-semibold leading-relaxed mt-2 text-muted-foreground">
              {gapAnalysis.description}
            </p>

            {/* Trigger Condition Box */}
            <div className="mt-3 p-2.5 bg-background/50 rounded-lg border border-border/20 shadow-inner">
              <p className="text-[10px] md:text-[11px] font-semibold text-muted-foreground/90 leading-normal">
                <span className="text-primary font-bold">발동 조건:</span> {gapAnalysis.condition}
              </p>
            </div>
            
            {macro.creditPercentile > 0 && (
              <div className="mt-3 pt-2.5 border-t border-border/20 flex justify-between items-center text-[9px] md:text-[10px] text-muted-foreground/80 font-mono">
                 <span>신용잔고 위치 (240일 기준)</span>
                 <div className="flex items-center gap-1.5">
                   <span title="역대 최저/최고 대비 %">MinMax: {macro.creditMinMax.toFixed(1)}%</span>
                   <span className="text-primary font-bold animate-pulse" title="전체 영업일 중 현재 위치">상위: {(100 - macro.creditPercentile).toFixed(1)}%</span>
                 </div>
              </div>
            )}
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
