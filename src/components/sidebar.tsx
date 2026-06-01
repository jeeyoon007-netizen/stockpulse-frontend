"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  History,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useState } from "react";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const menuItems = [
  {
    label: "대시보드",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    label: "관심종목 List",
    href: "/history",
    icon: History,
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "relative flex flex-col h-screen bg-sidebar border-r border-sidebar-border transition-all duration-300 ease-in-out",
        collapsed ? "w-[72px]" : "w-[260px]"
      )}
    >
      {/* Logo / Brand */}
      <div className="flex items-center gap-3 px-5 h-16 shrink-0">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-chart-2 shadow-lg shadow-primary/20">
          <TrendingUp className="w-5 h-5 text-primary-foreground" />
        </div>
        {!collapsed && (
          <div className="flex flex-col overflow-hidden animate-in fade-in slide-in-from-left-2 duration-200">
            <span className="text-sm font-bold text-sidebar-foreground tracking-tight">
              StockPulse
            </span>
            <span className="text-[10px] text-muted-foreground font-medium">
              실시간 주식 대시보드
            </span>
          </div>
        )}
      </div>

      <Separator className="bg-sidebar-border" />

      {/* Navigation */}
      <nav className="flex-1 flex flex-col gap-1 px-3 py-4">
        {menuItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          const linkContent = (
            <Link
              key={item.href}
              href={item.href}
              id={`nav-${item.href === "/" ? "dashboard" : item.href.slice(1)}`}
              className={cn(
                "group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-sidebar-accent text-sidebar-primary shadow-sm shadow-primary/10"
                  : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
              )}
            >
              <item.icon
                className={cn(
                  "w-5 h-5 shrink-0 transition-colors duration-200",
                  isActive
                    ? "text-sidebar-primary"
                    : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground/80"
                )}
              />
              {!collapsed && (
                <span className="animate-in fade-in slide-in-from-left-1 duration-150">
                  {item.label}
                </span>
              )}
              {isActive && !collapsed && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-sidebar-primary animate-live-pulse" />
              )}
            </Link>
          );

          if (collapsed) {
            return (
              <Tooltip key={item.href}>
                <TooltipTrigger>
                  <div className="w-full cursor-pointer">{linkContent}</div>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={12}>
                  {item.label}
                </TooltipContent>
              </Tooltip>
            );
          }

          return linkContent;
        })}
      </nav>

      {/* Bottom section */}
      <div className="px-3 pb-4">
        <Separator className="bg-sidebar-border mb-3" />
        <div
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-lg bg-sidebar-accent/30",
            collapsed ? "justify-center" : ""
          )}
        >
          <div className="w-2 h-2 rounded-full bg-stock-up animate-live-pulse shrink-0" />
          {!collapsed && (
            <span className="text-xs text-muted-foreground animate-in fade-in duration-200">
              실시간 연결됨
            </span>
          )}
        </div>
      </div>

      {/* Collapse toggle button */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-sidebar-accent border border-sidebar-border flex items-center justify-center hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all duration-200 shadow-md z-10"
        aria-label={collapsed ? "사이드바 펼치기" : "사이드바 접기"}
      >
        {collapsed ? (
          <ChevronRight className="w-3.5 h-3.5" />
        ) : (
          <ChevronLeft className="w-3.5 h-3.5" />
        )}
      </button>
    </aside>
  );
}
