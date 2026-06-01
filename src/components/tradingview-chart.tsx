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

interface TradingViewChartProps {
  data: OHLCV[];
  trades?: TradeMarker[];
}

export function TradingViewChart({ data, trades }: TradingViewChartProps) {
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

    const sortedData = [...data].sort((a, b) => a.date.localeCompare(b.date));
    
    // YYYYMMDD 포맷을 YYYY-MM-DD 포맷으로 변환 (lightweight-charts 포맷 요구)
    const chartData = sortedData.map((d) => {
      const year = d.date.substring(0, 4);
      const month = d.date.substring(4, 6);
      const day = d.date.substring(6, 8);
      return {
        time: `${year}-${month}-${day}`,
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
      };
    });

    const chartHeight = isMobile ? 240 : 360;

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
    });

    candleSeries.setData(chartData as any);

    // 백테스트 매매 마커 추가
    if (trades && trades.length > 0) {
      const markers = trades.map(t => {
        const year = t.trade_date.substring(0, 4);
        const month = t.trade_date.substring(4, 6);
        const day = t.trade_date.substring(6, 8);
        return {
          time: `${year}-${month}-${day}`,
          position: t.action === 'Buy' ? 'belowBar' : 'aboveBar',
          color: t.action === 'Buy' ? '#ef4444' : '#3b82f6', // KIS/한국 스타일 (빨강 매수, 파랑 매도)
          shape: t.action === 'Buy' ? 'arrowUp' : 'arrowDown',
          text: t.action === 'Buy' ? 'Buy' : 'Sell'
        };
      });
      // @ts-ignore
      candleSeries.setMarkers(markers);
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
  }, [data, isMobile]);

  return <div ref={chartContainerRef} className="w-full h-[240px] md:h-[360px]" />;
}
