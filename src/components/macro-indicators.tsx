import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, TrendingDown, TrendingUp, AlertCircle, ShieldAlert } from "lucide-react";

interface MacroIndicatorsProps {
  canaryData: any;
  marketOverview: any[];
}

export function MacroIndicators({ canaryData, marketOverview }: MacroIndicatorsProps) {
  const cdRatio = canaryData?.creditDepositRatio || 0;
  const cmRatio = canaryData?.creditMarketCapRatio || 0;

  // Thresholds Check
  const getLevel = (val: number, type: 'CD' | 'CM') => {
    if (type === 'CD') {
      if (val >= 90) return { level: '위험', color: 'bg-red-500', textColor: 'text-red-500', icon: ShieldAlert, alert: '🔴 위험: 급락 시 강제청산 연쇄 도미노 가능 구간입니다.' };
      if (val >= 75) return { level: '경고', color: 'bg-orange-500', textColor: 'text-orange-500', icon: AlertTriangle, alert: '🟠 경고: 조정 시 반대매매 연쇄 위험 구간입니다.' };
      if (val >= 60) return { level: '주의', color: 'bg-yellow-500', textColor: 'text-yellow-500', icon: AlertCircle, alert: '🟡 주의: 현금 대비 레버리지 과잉 누적이 시작되었습니다.' };
      return { level: '정상', color: 'bg-primary', textColor: 'text-primary', icon: null, alert: '🟢 정상: 레버리지 비율이 안정적입니다.' };
    } else {
      if (val >= 1.6) return { level: '위험', color: 'bg-red-500', textColor: 'text-red-500', icon: ShieldAlert, alert: '🔴 위험: 시장 규모 대비 신용이 한계치에 달했습니다.' };
      if (val >= 1.3) return { level: '경고', color: 'bg-orange-500', textColor: 'text-orange-500', icon: AlertTriangle, alert: '🟠 경고: 시장 하방 압력 시 투매를 유발할 수 있습니다.' };
      if (val >= 1.0) return { level: '주의', color: 'bg-yellow-500', textColor: 'text-yellow-500', icon: AlertCircle, alert: '🟡 주의: 시장 대비 레버리지가 경계 수준입니다.' };
      return { level: '정상', color: 'bg-primary', textColor: 'text-primary', icon: null, alert: '🟢 정상: 시가총액 대비 신용잔고가 안정권입니다.' };
    }
  };

  const cdStatus = getLevel(cdRatio, 'CD');
  const cmStatus = getLevel(cmRatio, 'CM');

  // 방향 괴리 감지 로직
  const kospi = marketOverview.find((m: any) => m.label === "코스피");
  const isMarketUp = kospi && (kospi.direction === "up" || kospi.direction === "상승");
  const isMarketDown = kospi && (kospi.direction === "down" || kospi.direction === "하락");
  
  const macro = canaryData?.macroAnalysis || {
    consecutiveDepositDecline: 0,
    consecutiveCreditIncrease: 0,
    creditMinMax: 0,
    creditPercentile: 0,
  };

  const depDown = macro.consecutiveDepositDecline;
  const credUp = macro.consecutiveCreditIncrease;

  let gapAnalysis = {
    title: "지수 vs 증시자금 괴리 분석",
    message: "장세에 따른 자금 이탈 모니터링 중입니다.",
    status: "정상", // '정상', '주의', '경고', '위험'
    color: "text-muted-foreground",
    icon: TrendingUp
  };

  if (depDown >= 3 && credUp >= 1) {
    gapAnalysis = {
      title: "위험: 최악의 자금 괴리",
      message: `🔴 현금(예탁금)은 ${depDown}일 연속 빠지는데 빚(신용)은 증가 중입니다. 레버리지 청산 압력이 커지는 매우 위험한 상태입니다.`,
      status: "위험",
      color: "text-red-500",
      icon: ShieldAlert
    };
  } else if (depDown >= 5) {
    gapAnalysis = {
      title: "위험: 강력한 자금 이탈",
      message: `🔴 예탁금이 ${depDown}일 연속 하락 중입니다. 시장 방향과 무관하게 자금 이탈이 확정적입니다.`,
      status: "위험",
      color: "text-red-500",
      icon: ShieldAlert
    };
  } else if (depDown >= 3 && isMarketDown) {
    gapAnalysis = {
      title: "경고: 투자심리 위축",
      message: `🟠 지수 하락과 함께 예탁금도 ${depDown}일 연속 하락 중입니다. 시장 분위기가 냉각되고 있습니다.`,
      status: "경고",
      color: "text-orange-500",
      icon: AlertTriangle
    };
  } else if (depDown >= 3 && isMarketUp) {
    gapAnalysis = {
      title: "경고: 투자자 이탈 신호",
      message: `🟠 지수는 상승 중이나 예탁금은 ${depDown}일 연속 하락했습니다. 겉보기와 달리 실질적 투자금이 빠져나가고 있습니다.`,
      status: "경고",
      color: "text-orange-500",
      icon: AlertTriangle
    };
  } else if (depDown >= 2 && isMarketUp) {
    gapAnalysis = {
      title: "주의: 자금 이탈 초기",
      message: `🟡 지수 상승에도 불구하고 예탁금이 2일 연속 하락했습니다. 추세를 관망하세요.`,
      status: "주의",
      color: "text-yellow-500",
      icon: AlertCircle
    };
  } else if (isMarketUp) {
    gapAnalysis.message = "지수가 상승하며 정상적인 자금 흐름을 보이고 있습니다.";
  }

  return (
    <Card className="border-border/50 bg-background/30 shadow-sm relative overflow-hidden">
      <CardHeader className="pb-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-primary/10 rounded-lg">
            <Activity className="w-5 h-5 text-primary" />
          </div>
          <CardTitle className="text-lg font-bold tracking-tight">시장 매크로 자금동향 모니터</CardTitle>
        </div>
        <CardDescription className="text-xs">
          레버리지 누적 현황 및 지수 간 방향성 괴리를 추적합니다.
        </CardDescription>
      </CardHeader>
      
      <CardContent className="pt-5 grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* CD Ratio */}
        <div className="space-y-3">
          <div className="flex justify-between items-end mb-1">
            <div className="text-xs font-bold text-muted-foreground">신용잔고 / 예탁금 비율</div>
            <div className={`text-xl font-black font-mono tracking-tighter ${cdStatus.textColor}`}>
              {cdRatio > 0 ? cdRatio.toFixed(1) : "0.0"}%
            </div>
          </div>
          <Progress value={Math.min(cdRatio, 100)} className={`h-2 [&>div]:${cdStatus.color}`} />
          <p className={`text-[10px] font-medium leading-relaxed ${cdStatus.textColor}`}>
            {cdStatus.alert}
          </p>
        </div>

        {/* CM Ratio */}
        <div className="space-y-3">
          <div className="flex justify-between items-end mb-1">
            <div className="text-xs font-bold text-muted-foreground">신용잔고 / 시가총액 비율</div>
            <div className={`text-xl font-black font-mono tracking-tighter ${cmStatus.textColor}`}>
              {cmRatio > 0 ? cmRatio.toFixed(2) : "0.00"}%
            </div>
          </div>
          <Progress value={Math.min((cmRatio / 2) * 100, 100)} className={`h-2 [&>div]:${cmStatus.color}`} />
          <p className={`text-[10px] font-medium leading-relaxed ${cmStatus.textColor}`}>
            {cmStatus.alert}
          </p>
        </div>

        {/* Gap Analysis */}
        <div className={`bg-background/50 rounded-xl p-3 border border-border/50 shadow-inner ${gapAnalysis.status === '위험' ? 'border-red-500/50 bg-red-500/5' : gapAnalysis.status === '경고' ? 'border-orange-500/50 bg-orange-500/5' : ''}`}>
          <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-1.5">
            <gapAnalysis.icon className={`w-3.5 h-3.5 ${gapAnalysis.color}`} />
            {gapAnalysis.title}
          </div>
          <div className="flex items-start gap-2 mt-2">
            <div className={`w-1.5 h-1.5 rounded-full mt-1.5 ${gapAnalysis.color.replace('text-', 'bg-')}`} />
            <p className={`text-xs font-medium leading-relaxed ${gapAnalysis.color}`}>
              {gapAnalysis.message}
            </p>
          </div>
          
          {macro.creditPercentile > 0 && (
            <div className="mt-3 pt-3 border-t border-border/30 flex justify-between items-center">
               <span className="text-[10px] text-muted-foreground">신용잔고 위치 (240일 기준)</span>
               <div className="flex items-center gap-2">
                 <span className="text-[10px] text-muted-foreground font-mono" title="역대 최저/최고 대비 %">MinMax: {macro.creditMinMax.toFixed(1)}%</span>
                 <span className="text-[10px] text-primary font-bold font-mono" title="전체 영업일 중 현재 위치">상위: {(100 - macro.creditPercentile).toFixed(1)}%</span>
               </div>
            </div>
          )}
        </div>

      </CardContent>
    </Card>
  );
}

// 아이콘 임포트를 위한 더미(위에서 누락 방지)
import { Activity } from "lucide-react";
