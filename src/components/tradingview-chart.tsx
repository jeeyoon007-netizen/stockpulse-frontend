"use client";

import { useEffect, useRef, useState } from "react";
import { createChart, ColorType } from "lightweight-charts";

interface OHLCV {
  date: string; // "20241011"
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface TradeMarker {
  trade_date: string;
  action: 'Buy' | 'Sell';
  price: number;
}

export interface SwingLevel {
  price: number;
  type: 'HIGH' | 'LOW';
  index: number;
  strength: number;
}

export interface VolumeProfileData {
  poc?: number;
  vah?: number;
  val?: number;
}

interface TradingViewChartProps {
  data: OHLCV[];
  trades?: TradeMarker[];
  swingLevels?: SwingLevel[];
  volumeProfile?: VolumeProfileData;
}

export function TradingViewChart({ data, trades, swingLevels, volumeProfile }: TradingViewChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);

  // 모바일 감지
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    if (!chartContainerRef.current || !data || data.length === 0) return;

    // HMR(Fast Refresh) 및 React Strict Mode 더블 렌더링 시 
    // 이전 차트 엘리먼트가 메모리/DOM에 잔존하는 것을 방지하기 위해 컨테이너 내부를 완전히 비웁니다.
    chartContainerRef.current.innerHTML = "";

    const sortedData = [...data].sort((a, b) => a.date.localeCompare(b.date));
    
    // YYYYMMDD 또는 YYYY-MM-DD HH:mm 포맷 변환 (lightweight-charts 요구사항 충족)
    const chartData = sortedData.map((d) => {
      let timeValue: any;
      
      if (d.date.includes(':')) {
        // 1분봉 포맷: YYYY-MM-DD HH:mm
        // KST 기준(UTC+9)이므로, lightweight-charts가 로컬로 해석하지 않도록
        // UTC 시간(UNIX Timestamp, 초 단위)으로 변환해서 주입
        const [datePart, timePart] = d.date.split(' ');
        const [year, month, day] = datePart.split('-');
        const [hour, minute] = timePart.split(':');
        
        // KST 시간을 기반으로 Date 객체 생성 (이 방식은 로컬 시스템의 타임존에 영향받으므로 명시적 UTC 연산)
        const dateObj = new Date(`${year}-${month}-${day}T${hour}:${minute}:00+09:00`);
        timeValue = Math.floor(dateObj.getTime() / 1000); // Unix Timestamp (seconds)
      } else {
        // 일봉 포맷: YYYYMMDD
        const year = d.date.substring(0, 4);
        const month = d.date.substring(4, 6);
        const day = d.date.substring(6, 8);
        timeValue = `${year}-${month}-${day}`; // String format for daily
      }

      return {
        time: timeValue,
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
      };
    });

    const chartHeight = isMobile ? 220 : 360;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "rgba(255, 255, 255, 0.7)",
        fontSize: isMobile ? 10 : 12,
      },
      grid: {
        vertLines: { color: "rgba(255, 255, 255, 0.05)" },
        horzLines: { color: "rgba(255, 255, 255, 0.05)" },
      },
      width: chartContainerRef.current.clientWidth,
      height: chartHeight,
      timeScale: {
        borderColor: "rgba(255, 255, 255, 0.1)",
        timeVisible: true,
      },
      rightPriceScale: {
        borderColor: "rgba(255, 255, 255, 0.1)",
      },
      handleScale: {
        mouseWheel: false, // 마우스 휠로 차트 확대/축소 비활성화 (페이지 스크롤 방해 방지)
        pinch: true,
      },
      handleScroll: {
        mouseWheel: true,   // 마우스 휠로 차트 이동은 허용
        pressedMouseMove: true,
        horzTouchDrag: true, // 모바일 수평 터치 드래그 지원
        vertTouchDrag: false, // 세로 터치는 페이지 스크롤에 양보
      },
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: "#ef4444", // KIS/한국 스타일: 상승이 빨강색
      downColor: "#3b82f6", // 하락이 파랑색
      borderVisible: false,
      wickUpColor: "#ef4444",
      wickDownColor: "#3b82f6",
      lastValueVisible: false, // 현재가 라벨 숨기기
      priceLineVisible: false, // 현재가 수평선 숨기기
    });

    candleSeries.setData(chartData as any);

    // 백테스트 매매 마커 추가 (요청에 따라 전체 화면에서 완전히 제거)
    // @ts-ignore
    candleSeries.setMarkers([]);

    // 스윙 레벨 (지지/저항선) 추가
    if (swingLevels && swingLevels.length > 0) {
      const limit = isMobile ? 1 : 2;
      const highs = swingLevels.filter(l => l.type === 'HIGH').sort((a, b) => b.index - a.index).slice(0, limit);
      const lows = swingLevels.filter(l => l.type === 'LOW').sort((a, b) => b.index - a.index).slice(0, limit);
      const displaySwingLevels = [...highs, ...lows];

      displaySwingLevels.forEach((level) => {
        const isHigh = level.type === 'HIGH';
        candleSeries.createPriceLine({
          price: level.price,
          color: isHigh ? 'rgba(239, 68, 68, 0.4)' : 'rgba(59, 130, 246, 0.4)', // 붉은색(저항), 푸른색(지지) + 투명도
          lineWidth: isMobile ? 1 : (isHigh ? 1 : 2),
          lineStyle: 2, // 2: Dashed
          axisLabelVisible: true,
          title: '',
        });
      });
    }

    // 볼륨 프로파일 (POC, VAH, VAL) 추가
    if (volumeProfile) {
      if (volumeProfile.poc) {
        candleSeries.createPriceLine({
          price: volumeProfile.poc,
          color: 'rgba(234, 179, 8, 0.7)', // 뚜렷한 노란색/금색
          lineWidth: 2,
          lineStyle: 0, // 0: Solid
          axisLabelVisible: true,
          title: '',
        });
      }
      if (volumeProfile.vah) {
        candleSeries.createPriceLine({
          price: volumeProfile.vah,
          color: 'rgba(156, 163, 175, 0.5)', // 연한 회색
          lineWidth: 1,
          lineStyle: 2, // Dashed
          axisLabelVisible: true,
          title: '',
        });
      }
      if (volumeProfile.val) {
        candleSeries.createPriceLine({
          price: volumeProfile.val,
          color: 'rgba(156, 163, 175, 0.5)', // 연한 회색
          lineWidth: 1,
          lineStyle: 2, // Dashed
          axisLabelVisible: true,
          title: '',
        });
      }
    }

    chart.timeScale().fitContent();

    // ResizeObserver로 컨테이너 크기 변경 감지 (모바일 회전 등)
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width } = entry.contentRect;
        if (width > 0) {
          chart.applyOptions({ width });
        }
      }
    });
    resizeObserver.observe(chartContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
    };
  }, [data, isMobile, trades, swingLevels, volumeProfile]);

  return <div ref={chartContainerRef} className="w-full h-[220px] md:h-[360px]" />;
}
