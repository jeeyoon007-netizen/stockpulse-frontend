"use client";

import React from "react";
import { type FearGreedMarketData } from "@/lib/api/feargreed";

interface Props {
  data: FearGreedMarketData;
  title: string;
}

export function FearGreedGauge({ data, title }: Props) {
  const { score, label } = data;
  
  // score에 따른 색상 결정
  const getColor = (s: number) => {
    if (s <= 25) return "#ef4444"; // 극단적 공포 (Red)
    if (s <= 45) return "#f97316"; // 공포 (Orange)
    if (s <= 55) return "#eab308"; // 중립 (Yellow)
    if (s <= 75) return "#22c55e"; // 탐욕 (Green)
    return "#10b981"; // 극단적 탐욕 (Emerald)
  };

  const color = getColor(score);
  const rotation = (score / 100) * 180 - 90; // -90 to 90 degrees for half circle

  return (
    <div className="flex flex-col items-center p-3 md:p-4 bg-background/40 rounded-xl border border-border/50 relative overflow-hidden group hover:border-primary/30 transition-all duration-300">
      <h3 className="text-xs md:text-sm font-extrabold text-foreground tracking-tight mb-3 md:mb-4 text-center uppercase flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
        {title}
      </h3>
      
      <div className="relative w-36 h-[72px] md:w-48 md:h-24 mb-4 md:mb-6">
        {/* Gauge Background (Semi-circle) */}
        <div className="absolute inset-0 w-36 h-36 md:w-48 md:h-48 rounded-full border-[10px] md:border-[12px] border-muted/20 border-b-transparent"></div>
        
        {/* Gauge Color fill (Simplified with a overlay mask or just a SVG) */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 50">
          <path
            d="M 10 50 A 40 40 0 0 1 90 50"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            strokeLinecap="round"
            className="text-muted/10"
          />
          <path
            d="M 10 50 A 40 40 0 0 1 90 50"
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray="125.6" // (40 * PI) / 2
            strokeDashoffset={125.6 * (1 - score / 100)}
            className="transition-all duration-1000 ease-out"
          />
        </svg>

        {/* Needle */}
        <div 
          className="absolute bottom-0 left-1/2 w-1 h-16 md:h-20 bg-foreground origin-bottom rounded-full transition-transform duration-1000 ease-out z-10"
          style={{ transform: `translateX(-50%) rotate(${rotation}deg)` }}
        >
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3 h-3 bg-foreground rounded-full shadow-lg"></div>
        </div>
        
        {/* Center Text */}
        <div className="absolute bottom-[-10px] left-1/2 -translate-x-1/2 text-center">
            <span className="text-3xl md:text-4xl font-black tracking-tighter" style={{ color }}>{score}</span>
        </div>
      </div>

      <div className="text-center mt-2">
        <span className="text-base md:text-lg font-bold px-3 py-1 rounded-full bg-muted/30" style={{ color }}>
          {label}
        </span>
      </div>
      
      {/* Indicators List (Small) */}
      <div className="grid grid-cols-2 gap-x-3 md:gap-x-4 gap-y-2 mt-4 md:mt-6 w-full opacity-95 md:opacity-90 group-hover:opacity-100 transition-opacity">
        {data.indicators.slice(0, 4).map((ind, i) => (
          <div key={i} className="flex justify-between items-center text-[10.5px] md:text-xs font-semibold py-0.5 border-b border-border/10 pb-1">
            <span className="text-muted-foreground truncate mr-2">{ind.name}</span>
            <span className="font-mono font-black text-foreground">{ind.raw ?? ind.value}{ind.unit ?? ""}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
