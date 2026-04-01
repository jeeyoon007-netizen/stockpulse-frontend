"use client";

import { useEffect, useRef } from "react";
import { createChart, ColorType } from "lightweight-charts";

interface OHLCV {
  date: string; // "20241011"
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface TradingViewChartProps {
  data: OHLCV[];
}

export function TradingViewChart({ data }: TradingViewChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);

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

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "rgba(255, 255, 255, 0.7)",
      },
      grid: {
        vertLines: { color: "rgba(255, 255, 255, 0.05)" },
        horzLines: { color: "rgba(255, 255, 255, 0.05)" },
      },
      width: chartContainerRef.current.clientWidth,
      height: 360,
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
        mouseWheel: true,   // 마우스 휠로 차트 이동은 허용 (옵션에 따라 다름, 보통 줌이 꺼지면 스크롤로 동작)
        pressedMouseMove: true,
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

    chart.timeScale().fitContent();

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, [data]);

  return <div ref={chartContainerRef} className="w-full h-[360px]" />;
}
