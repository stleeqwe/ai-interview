# AI 모의면접 서비스

> 제 1회 OKKY 바이브코딩 해커톤 출품작

| 항목 | 내용 |
|------|------|
| **팀명** | 이승태팀 |
| **프로젝트명** | AI 모의면접 서비스 |
| **GitHub** | https://github.com/stleeqwe/ai-interview |
| **데모** | 직접 시연 |
| **한 줄 소개** | 이력서와 포지션 상세 공고 내용을 기반으로 AI 모의면접을 실시하고 결과를 평가받을 수 있는 서비스 |
| **팀 소개** | 이승태 — 프로덕트 기획 및 개발 |

## 문제 정의

실제 기술 면접 준비 시 지원자는 예상 질문을 스스로 만들어 연습하거나 주변인에게 부탁해야 하는데, 이 방식으로는 지원 포지션과 본인 이력에 맞는 깊이 있는 질문을 받기 어렵고, 실시간 대화 형태의 면접 연습은 거의 불가능합니다. AI 모의면접 서비스는 이력서와 채용공고를 분석하여 맞춤형 면접 시나리오를 자동 설계하고, 3D 아바타 면접관과 텍스트 채팅 기반 면접을 진행한 뒤, 상세한 평가 리포트를 제공합니다.

## 핵심 기능

- **맞춤형 면접 시나리오 생성** — 이력서 + 채용공고 분석 후 5개 질문, 꼬리질문, 평가 기준을 자동 설계
- **웹 그라운딩 리서치** — 회사/도메인/기술 트렌드를 실시간 검색하여 현실감 있는 질문 생성
- **3D 아바타 텍스트 면접** — Gemini 3 Flash 기반 턴제 채팅 + 3D 아바타 표정/자세 애니메이션
- **브라우저 STT 지원** — 선택적 음성 입력 (Web Speech API, Chrome 권장)
- **종합 평가 리포트** — 5개 역량 레이더, 질문별 점수, 개선 액션 아이템 제공

## 기술 스택

| 영역 | 기술 |
|------|------|
| 프레임워크 | Next.js 16, React 19, TypeScript |
| AI/LLM | Gemini 3 Flash (시나리오 생성, 그라운딩, 면접 진행, 평가) |
| 3D 렌더링 | Three.js, React Three Fiber, Mixamo 애니메이션 |
| 상태 관리 | Zustand + Immer |
| 스키마 검증 | Zod 4 |
| UI | Tailwind CSS 4, shadcn/ui, Radix UI |
| 파일 처리 | unpdf (PDF), mammoth (DOCX), file-type (매직 바이트) |
| 모니터링 | Dexie (IndexedDB) 기반 파이프라인 모니터링 |

## 빌드 및 실행

### 사전 요구사항

- Node.js 22+
- npm 10+
- API 키 1종: Google AI (`GOOGLE_API_KEY`)

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
# Google API (전체 파이프라인 — Gemini 3 Flash)
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
3. `/interview` — 3D 아바타 면접관과 텍스트 채팅 (선택: 브라우저 STT 음성 입력)
4. `/feedback` — 평가 리포트 확인

## 프로젝트 구조

```
app/
├── page.tsx                    # 업로드 화면
├── loading/page.tsx            # 분석 진행 화면
├── interview/page.tsx          # 면접 진행 화면 (3D 아바타 + 텍스트 채팅)
├── feedback/page.tsx           # 평가 결과 화면
├── dev/
│   ├── monitor/page.tsx        # 파이프라인 모니터링 대시보드
│   └── grounding/page.tsx      # 그라운딩 리서치 디버그
├── api/
│   ├── analyze/route.ts        # Stage 0→1: 시나리오 생성 (Gemini)
│   ├── chat/route.ts           # Stage 2: 턴제 텍스트 면접 (Gemini)
│   ├── evaluate/route.ts       # Stage 3: 면접 평가 (Gemini)
│   ├── parse-resume/route.ts   # 이력서 파싱
│   ├── fetch-job/route.ts      # 채용공고 스크래핑
│   └── ocr/route.ts            # 이미지 OCR (Gemini)
components/
├── interview/                  # 3D 아바타, 타이머, 대화록, 입력 UI
├── feedback/                   # 평가 차트, 질문별 점수, 액션 아이템
├── upload/                     # 이력서 업로더, 채용공고 입력
└── ui/                         # shadcn/ui 컴포넌트
hooks/
├── useChatSession.ts           # 텍스트 채팅 세션 관리
├── useSpeechToText.ts          # 브라우저 STT (Web Speech API)
└── useElapsedTimer.ts          # 면접 타이머
lib/
├── prompts.ts                  # 시스템 프롬프트 (Stage 0/1/2/3)
├── gemini.ts                   # Gemini API 클라이언트 + 그라운딩 리서치
├── resume-parser.ts            # 파일 파싱 (PDF/DOCX)
├── schemas/                    # Zod 스키마 (면접 설정, 평가)
├── types/                      # 모니터링 타입 정의
└── monitoring/                 # IndexedDB 기반 모니터링 저장소
stores/
├── interviewStore.ts           # 면접 전역 상태 (Zustand)
└── monitorStore.ts             # 모니터링 상태 (Zustand)
```

## AI 파이프라인

```
이력서 + 채용공고
       ↓
[Stage 0] Gemini Flash → 조사 지시문 생성
       ↓
[Grounding] Gemini Search → 웹 검색 + 리서치 종합
       ↓
[Stage 1] Gemini Flash → 면접 시나리오 설계 (5개 질문 + 꼬리질문)
       ↓
[Stage 2] Gemini Flash → 턴제 텍스트 채팅 면접 (동적 꼬리질문)
       ↓
[Stage 3] Gemini Flash → 종합 평가 리포트
```

**비용**: ~$0.08 ~ $0.12/회 (Gemini 단일 벤더)

## 외부 자료 및 라이선스

| 자료 | 출처 | 라이선스 |
|------|------|---------|
| Three.js | [threejs.org](https://threejs.org) | MIT |
| React Three Fiber | [GitHub](https://github.com/pmndrs/react-three-fiber) | MIT |
| shadcn/ui | [ui.shadcn.com](https://ui.shadcn.com) | MIT |
| Pretendard 폰트 | [GitHub](https://github.com/orioncactus/pretendard) | OFL |
| ReadyPlayerMe 아바타 | [readyplayer.me](https://readyplayer.me) | RPM License |
| unpdf | [GitHub](https://github.com/nicolo-ribaudo/unpdf) | MIT |
| mammoth | [GitHub](https://github.com/mwilliamson/mammoth.js) | BSD-2 |

## 팀 & AI 사용 내역

| 이름 | 역할 |
|------|------|
| 이승태 | 프로덕트 기획 및 개발 |

- **AI 도구**: Claude Code (코드 생성, 아키텍처 설계, 디버깅, 문서 작성)
- **AI 검증**: 모든 AI 생성 코드는 개발자가 직접 검토 후 커밋

---

*제 1회 OKKY 바이브코딩 해커톤 (2026-02-21)*
