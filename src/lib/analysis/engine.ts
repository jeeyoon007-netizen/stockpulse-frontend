import { calculateIndicators, type IndicatorsResult } from "./indicators";
import {
  evaluateTrend,
  evaluateEnergy,
  evaluateMomentum,
  type ExpertOpinion,
  type OpinionType,
} from "./experts";

export interface AuditLog {
  step: number;
  expertName: string;
  message: string;
}

export interface StrategyScenario {
  currentPrice: number;
  entryRange: string;
  stopLoss: number;
  targetPrimary: number;
  targetSecondary: number;
}

export interface AIAnalysisResult {
  experts: ExpertOpinion[];
  auditLogs: AuditLog[];
  strategy: StrategyScenario;
  finalVerdict: OpinionType;
}

/**
 * 3인의 의견을 교차 검증(CrossCheck)하여 상호 반박 및 Audit Log를 생성합니다.
 */
function crossCheck(experts: ExpertOpinion[]): {
  logs: AuditLog[];
  verdict: OpinionType;
} {
  const logs: AuditLog[] = [];
  
  const trend = experts.find((e) => e.expertName.includes("추세"))!;
  const energy = experts.find((e) => e.expertName.includes("에너지"))!;
  const momentum = experts.find((e) => e.expertName.includes("모멘텀"))!;

  let upVotes = 0;
  let downVotes = 0;
  
  experts.forEach((e) => {
    if (e.opinion === "상승") upVotes++;
    else if (e.opinion === "하락") downVotes++;
  });

  // 1단계: 논리적 충돌 탐지
  if (trend.opinion === "상승" && momentum.opinion === "하락") {
    logs.push({
      step: 1,
      expertName: momentum.expertName,
      message: `파동/추세 전문가는 [상승]을 주장하지만, 모멘텀 지표 측면에서 매도 압박 및 과매수 신호가 강해 단기 조정을 경고합니다.`,
    });
  } else if (trend.opinion === "하락" && energy.opinion === "상승") {
    logs.push({
      step: 1,
      expertName: energy.expertName,
      message: `전반적인 추세는 [하락]이나, 바닥권에서 스마트머니(MFI) 또는 거래량 가중평균(VWAP)을 상회하는 강력한 수급이 감지되어 반등을 시도 중입니다.`,
    });
  } else if (upVotes === 3 || downVotes === 3) {
    logs.push({
      step: 1,
      expertName: "System",
      message: `세 전문가의 방향성이 완벽히 일치합니다. [${upVotes === 3 ? "상승" : "하락"}] 추세가 고착화되었습니다.`,
    });
  } else {
    logs.push({
      step: 1,
      expertName: "System",
      message: `전문가 간 혼조세 속 다수결에 따른 기본 방향성을 탐색 중입니다.`,
    });
  }

  // 2단계: 최종 합의
  let verdict: OpinionType = "횡보/보합";
  if (upVotes >= 2) verdict = "상승";
  else if (downVotes >= 2) verdict = "하락";

  logs.push({
    step: 2,
    expertName: "총괄 AI",
    message: `전문가 의견 종합 결과, 3인 중 상승 ${upVotes}명, 하락 ${downVotes}명으로 최종 방향성은 [${verdict}]을 향하고 있습니다.`,
  });

  return { logs, verdict };
}

/**
 * 피보나치 + ATR 기준 전략 산출
 */
function calculateStrategy(data: IndicatorsResult): StrategyScenario {
  const { lastClose, recentHigh, recentLow, atr } = data;
  
  // 피보나치 되돌림 계산
  const diff = recentHigh - recentLow;
  const fibo382 = recentHigh - diff * 0.382;
  const fibo618 = recentHigh - diff * 0.618;
  
  // ATR을 활용한 변동성 계산 (안전마진 반영)
  // 매수 시점: 현재가 주변이나 주요 지지선
  const stopLoss = Math.floor(lastClose - atr * 1.5);
  let targetPrimary = Math.floor(lastClose + atr * 2.0);
  let targetSecondary = Math.floor(lastClose + atr * 3.5);

  // 피보나치 저항 및 지지 대조 (추가 보정)
  if (targetPrimary > recentHigh) targetPrimary = recentHigh;
  if (targetPrimary <= lastClose) targetPrimary = Math.floor(lastClose * 1.05);
  
  // 목표가가 피보나치 0.382 구간과 비슷하다면 수렴
  if (Math.abs(targetPrimary - fibo382) / targetPrimary < 0.03) {
    targetPrimary = Math.floor(fibo382);
  }

  const entryStart = Math.min(lastClose, Math.floor(fibo618));
  const entryEnd = Math.max(lastClose, Math.floor(fibo618));

  return {
    currentPrice: lastClose,
    entryRange: `${entryStart.toLocaleString()} ~ ${entryEnd.toLocaleString()}`,
    stopLoss,
    targetPrimary,
    targetSecondary,
  };
}

/**
 * 입체 주식 분석 엔진 메인 오케스트레이션 함수
 */
export function runAnalysisEngine(ohlcvs: any[]): AIAnalysisResult {
  // 1. 기초 지표 계산
  const data = calculateIndicators(ohlcvs);

  // 2. 전문가 호출
  const tExpert = evaluateTrend(data);
  const eExpert = evaluateEnergy(data);
  const mExpert = evaluateMomentum(data);
  const experts = [tExpert, eExpert, mExpert];

  // 3. 상호 반박 및 교차 검증 (Audit Logs)
  const { logs, verdict } = crossCheck(experts);

  // 4. 전략(시나리오) 산출
  const strategy = calculateStrategy(data);

  return {
    experts,
    auditLogs: logs,
    strategy,
    finalVerdict: verdict,
  };
}
