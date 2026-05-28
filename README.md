---
title: StockPulse Frontend (KIS AI Analyzer)
emoji: 📈
colorFrom: blue
colorTo: indigo
sdk: docker
pinned: false
app_port: 7860
build_args:
  - NEXT_PUBLIC_SUPABASE_URL
  - NEXT_PUBLIC_SUPABASE_ANON_KEY
---

# StockPulse Frontend (Next.js)

StockPulse is an AI-powered stock dashboard fetching real-time market data and generating trading insights.

## Recent Features
- **Phase 1: Macro Market Indicators**: Added real-time tracking for credit-to-deposit ratio (신용잔고/예탁금 비율) and credit-to-market-cap ratio (신용잔고/시가총액 비율) to monitor leverage in the Korean stock market.
- **Phase 2: Macro Funds Trend System (매크로 자금동향 시스템)**:
  - Supabase Time-series DB Integration for tracking Market Funds & Credit History.
  - Backend 16:00 Scheduler for daily accumulation of financial data.
  - Advanced Gap Analysis with 5 Warning Levels based on deposit consecutive decline, credit increase, and index divergence.
  - Credit Balance Percentile & Min-Max normalizations evaluated against rolling 240 trading days.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Architecture Guidelines
- **Frontend (Vercel)**: Next.js handles purely presentation and real-time WebSocket subscriptions.
- **Backend (Render)**: Heavy computations, caching (70s), and scheduled tasks are run on the backend.
