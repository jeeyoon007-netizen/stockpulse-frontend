<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# StockPulse Frontend - AI Git 배포 워크플로우 규칙

## ⚠️ 필수: "수정사항 깃해줘" 명령 처리 절차

사용자가 "수정사항 깃해줘", "깃 푸시해줘", "배포해줘" 등을 말하면 **반드시 아래 순서를 따른다.**

### Git 푸시 순서 (PowerShell 기준)

```powershell
# 1. main 브랜치에 커밋
git -C "c:\Users\jeeyo\OneDrive\바탕 화면\study\frontend(pwa)" add -A
git -C "c:\Users\jeeyo\OneDrive\바탕 화면\study\frontend(pwa)" commit -m "<커밋 메시지>"

# 2. Vercel 배포를 위한 main 브랜치 푸시
git -C "c:\Users\jeeyo\OneDrive\바탕 화면\study\frontend(pwa)" push origin main
```

## 프로젝트 배포 구조

| 레포지토리 | 로컬 경로 | GitHub | 배포 플랫폼 | 추적 브랜치 |
|---|---|---|---|---|
| 프론트엔드 | `study/frontend(pwa)` | `stockpulse-frontend` | **Vercel** | `main` |
| 백엔드 | `study/backend` | `stockpulse-backend` | **Render** | `main` |

## 백엔드 Git 푸시 (Render)

```powershell
git -C "c:\Users\jeeyo\OneDrive\바탕 화면\study\backend" add -A
git -C "c:\Users\jeeyo\OneDrive\바탕 화면\study\backend" commit -m "<커밋 메시지>"
git -C "c:\Users\jeeyo\OneDrive\바탕 화면\study\backend" push origin main
```

## 🏗 아키텍처 및 역할 분담 (Architecture Guidelines)

* **프론트엔드 (Next.js)**: 순수한 **View 역할**만 담당합니다. Supabase DB의 결과를 읽어오거나 가벼운 실시간 구독(Realtime)만 처리합니다. 무거운 주식 분석 로직이나 기술 지표 계산(RSI, MFI 등)을 서버 액션(`actions.ts`) 등에 구현하지 마세요.
* **백엔드 (Express)**: **비즈니스 로직 및 분석 본체**입니다. `node-cron` 등을 활용하여 장마감 후 자동 분석, 70초 주기 실시간 데이터 갱신 및 계산을 수행하고 그 결과를 Supabase에 저장하는 역할을 전담합니다.

## 환경변수 현황 (Vercel)

| 변수명 | 용도 |
|---|---|
| `BACKEND_URL` | Render 백엔드 URL (서버 액션 런타임용, 접두사 없음 주의) |
| `NEXT_PUBLIC_BACKEND_URL` | 레거시 호환용 (양쪽 모두 설정) |
| `KIS_APP_KEY` / `KIS_APP_SECRET` | 한국투자증권 API 인증 |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase DB |
| `HF_SPACE_TOKEN` | Hugging Face Space 배포 토큰 |

## 주의사항

- PowerShell에서는 `&&` 연산자를 쓰지 말 것 → `;` 또는 별도 커맨드로 실행
- 프론트엔드 서버 액션(`actions.ts`)은 `"use server"` 환경 → `NEXT_PUBLIC_` 변수가 빌드 타임에만 번들링되므로, 런타임 환경변수는 접두사 없는 `BACKEND_URL`을 사용해야 함
- 데이터 단위: 백엔드는 원(KRW) raw 값 반환 → UI 표시 시 반드시 단위 변환 필요
  - 예탁금: `÷ 100,000,000` (억 단위 변환 후 formatMoney)
  - 신용잔고: `÷ 1,000,000,000,000` (조 단위 변환)
