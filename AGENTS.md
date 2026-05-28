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

## 📊 ADR (등락비율) 관리 규칙

### 1. ADR 정의 및 계산식
ADR(Advance Decline Ratio, 등락비율)은 일정 기간 동안 상승한 종목 수와 하락한 종목 수의 비율을 나타내는 시장 심리 지표입니다.
- **공식**:
  $$\text{ADR (\%)} = \left( \frac{\text{20거래일 동안의 상승 종목 수 누적 합}}{\text{20거래일 동안의 하락 종목 수 누적 합}} \right) \times 100$$
- **의미**: 일반적으로 120% 이상이면 과열(매도 신호), 75% 이하면 침체(매수 신호)로 해석합니다.

### 2. 한국투자증권 API 한계 및 장애 대응 규칙
- **⚠️ 중요 경고**: **한국투자증권 API로는 ADR 또는 과거 20일간의 개별 영업일 상승/하락 종목 수 데이터를 조회할 수 없습니다.**
  - `FHPUP02120000`(국내업종 일자별지수)을 비롯한 KIS API의 일별 지수 시세 응답 항목에는 상승/하락 종목 수(`ascn_issu_cnt`, `down_issu_cnt`) 필드가 제공되지 않습니다.
  - 따라서 KIS API를 이용한 백엔드 분석 로직으로 ADR 수치를 복구하거나 계산하는 시도는 **원천적으로 불가**하므로 절대 시도하지 마십시오.
- **해결 대안 (Vercel 프론트엔드 크롤링)**:
  - 현재 시스템은 외부 ADR 전문 제공 사이트(`adrinfo.kr`)를 크롤링하여 데이터를 표시합니다.
  - 백엔드(Render 호스팅 환경)의 고정 IP는 `adrinfo.kr` 서버로부터 `403 Forbidden` 차단을 당하므로, 백엔드 수집 로직에서는 ADR을 제외하고 `null`을 반환합니다.
  - **프론트엔드 Vercel 서버 액션(`fetchCanaryDataAction`)** 내에서 Vercel의 동적 IP 대역을 이용하여 직접 `fetchADRFromInfo()` 크롤링을 호출하고 백엔드 데이터와 동적으로 병합하여 화면에 주입합니다.
  - 관련 오류가 발생할 시, KIS API로 우회하려고 삽질하지 말고 크롤링 소스(HTML 파싱 셀렉터 등)를 점검해야 합니다.

