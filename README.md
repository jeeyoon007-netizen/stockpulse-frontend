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

## Recent Features (Phase 1)
- **Macro Market Indicators**: Added real-time tracking for credit-to-deposit ratio (신용잔고/예탁금 비율) and credit-to-market-cap ratio (신용잔고/시가총액 비율) to monitor leverage in the Korean stock market.
- **Dynamic Warning Thresholds**: 
  - Caution (🟡), Warning (🟠), and Danger (🔴) signals are displayed when leverage density hits historical extremes.
- **Independent Layout**: Macro indicators are isolated into a separate component, preserving the original top canary metrics.

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
