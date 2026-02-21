# AI 모의면접 (AI Mock Interview)

> 제 1회 OKKY 바이브코딩 해커톤 출품작

이력서와 채용공고를 업로드하면 AI가 맞춤형 면접 시나리오를 설계하고, 3D 아바타 면접관과 실시간 음성 면접을 진행한 뒤, 상세한 평가 리포트를 제공하는 AI 모의면접 서비스입니다.

## 핵심 기능

- **맞춤형 면접 시나리오 생성** — 이력서 + 채용공고 분석 후 5개 질문, 꼬리질문, 평가 기준을 자동 설계
- **웹 그라운딩 리서치** — 회사/도메인/기술 트렌드를 실시간 검색하여 현실감 있는 질문 생성
- **3D 아바타 음성 면접** — OpenAI Realtime API + TalkingHead 립싱크 아바타로 실감나는 면접 경험
- **종합 평가 리포트** — 5개 역량 레이더, 질문별 점수, 개선 액션 아이템 제공

## 기술 스택

| 영역 | 기술 |
|------|------|
| 프레임워크 | Next.js 16, React 19, TypeScript |
| AI/LLM | Claude Sonnet 4.6 (분석), Gemini 3 Flash (그라운딩/평가), GPT Realtime (음성) |
| 3D 렌더링 | Three.js, React Three Fiber, @met4citizen/talkinghead |
| 상태 관리 | Zustand + Immer |
| 스키마 검증 | Zod 4 |
| UI | Tailwind CSS 4, shadcn/ui, Radix UI |
| 파일 처리 | unpdf (PDF), mammoth (DOCX), file-type (매직 바이트) |

## 빌드 및 실행

### 사전 요구사항

- Node.js 22+
- npm 10+
- API 키 3종: Anthropic, OpenAI, Google AI

### 설치

```bash
git clone https://github.com/stleeqwe/ai-interview.git
cd ai-interview
npm install
```

### 환경 변수 설정

```bash
cp .env.local.example .env.local
```

`.env.local`에 다음 키를 입력:

```env
# Anthropic API (면접 시나리오 설계 — Claude Sonnet)
ANTHROPIC_API_KEY=sk-ant-...

# OpenAI API (실시간 음성 면접 — GPT Realtime)
OPENAI_API_KEY=sk-...

# Google API (웹 그라운딩 리서치 + 평가 — Gemini)
GOOGLE_API_KEY=AI...
```

### 개발 서버

```bash
npm run dev
# http://localhost:3000
```

### 프로덕션 빌드

```bash
npm run build
npm start
```

### Docker

```bash
docker build -t ai-interview .
docker run -p 8080:8080 --env-file .env.local ai-interview
```

### 린트

```bash
npm run lint
```

## 테스트

### E2E 파이프라인 테스트

Stage 0→1→2 전체 파이프라인을 3가지 시나리오로 검증:

```bash
npx tsx scripts/test-pipeline.ts          # 전체 실행
npx tsx scripts/test-pipeline.ts --case=1 # 특정 케이스
npx tsx scripts/test-pipeline.ts --json   # JSON 덤프 포함
```

### 수동 테스트

1. `/` — 이력서(PDF/DOCX) + 채용공고(URL/붙여넣기/스크린샷) 업로드
2. `/loading` — 분석 진행 상황 확인
3. `/interview` — 마이크 권한 허용 → 면접관과 음성 대화
4. `/feedback` — 평가 리포트 확인

## 프로젝트 구조

```
app/
├── page.tsx                    # 업로드 화면
├── loading/page.tsx            # 분석 진행 화면
├── interview/page.tsx          # 면접 진행 화면 (풀스크린 3D)
├── feedback/page.tsx           # 평가 결과 화면
├── api/
│   ├── analyze/route.ts        # Stage 0→1: 시나리오 생성
│   ├── session/route.ts        # OpenAI Realtime 세션 발급
│   ├── evaluate/route.ts       # Stage 3: 면접 평가
│   ├── parse-resume/route.ts   # 이력서 파싱
│   ├── fetch-job/route.ts      # 채용공고 스크래핑
│   └── ocr/route.ts            # 이미지 OCR
components/
├── interview/                  # 3D 아바타, 타이머, 대화록, 카메라
├── feedback/                   # 평가 차트, 질문별 점수, 액션 아이템
├── upload/                     # 이력서 업로더, 채용공고 입력
└── ui/                         # shadcn/ui 컴포넌트
hooks/
├── useRealtimeSession.ts       # WebRTC 세션 관리
├── useElapsedTimer.ts          # 면접 타이머
└── useMediaPermissions.ts      # 마이크/카메라 권한
lib/
├── claude.ts                   # Claude API + 시스템 프롬프트
├── gemini.ts                   # Gemini 그라운딩 리서치
├── resume-parser.ts            # 파일 파싱 (PDF/DOCX)
└── schemas/                    # Zod 스키마 (면접 설정, 평가)
stores/
└── interviewStore.ts           # Zustand 전역 상태
```

## AI 파이프라인

```
이력서 + 채용공고
       ↓
[Stage 0] Claude Sonnet → 조사 지시문 생성
       ↓
[Grounding] Gemini → 웹 검색 + 리서치 종합
       ↓
[Stage 1] Claude Sonnet → 면접 시나리오 설계 (5개 질문)
       ↓
[면접] GPT Realtime → 실시간 음성 대화 (WebRTC)
       ↓
[Stage 3] Gemini → 종합 평가 리포트
```

## 외부 자료 및 라이선스

| 자료 | 출처 | 라이선스 |
|------|------|---------|
| @met4citizen/talkinghead | [GitHub](https://github.com/nicefeel/talkinghead) | MIT |
| Three.js | [threejs.org](https://threejs.org) | MIT |
| React Three Fiber | [GitHub](https://github.com/pmndrs/react-three-fiber) | MIT |
| shadcn/ui | [ui.shadcn.com](https://ui.shadcn.com) | MIT |
| Pretendard 폰트 | [GitHub](https://github.com/orioncactus/pretendard) | OFL |
| ReadyPlayerMe 아바타 | [readyplayer.me](https://readyplayer.me) | RPM License |
| unpdf | [GitHub](https://github.com/nicolo-ribaudo/unpdf) | MIT |
| mammoth | [GitHub](https://github.com/mwilliamson/mammoth.js) | BSD-2 |

## 팀 & AI 사용 내역

- **개발**: 이승태 (1인)
- **AI 도구**: Claude Code (코드 생성, 아키텍처 설계, 디버깅)
- **AI 검증**: 모든 AI 생성 코드는 개발자가 직접 검토 후 커밋

---

*제 1회 OKKY 바이브코딩 해커톤 (2026-02-21)*
