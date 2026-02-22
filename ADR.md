# ADR.md — 아키텍처 결정 기록

## ADR-001: Gemini 단일 벤더 파이프라인

**상태:** 채택 (ADR-001-v1 대체)

**맥락:**
초기 버전에서는 3개 벤더(Claude + Gemini + OpenAI)를 파이프라인으로 연결했으나, API 키 3종 관리, 높은 비용($2.20/회), 벤더 간 장애 전파 문제가 있었다.

**결정:**
전체 파이프라인을 Gemini 3 Flash 단일 모델로 통합:
1. **Gemini Flash** (Stage 0) — 이력서/공고 분석 후 웹 리서치 지시문 생성
2. **Gemini Search** (Grounding) — Google Search 기반 웹 리서치 수행
3. **Gemini Flash** (Stage 1) — 리서치 결과 + 분석을 종합하여 면접 시나리오 설계
4. **Gemini Flash** (Stage 2) — 턴제 텍스트 채팅 면접 진행
5. **Gemini Flash** (Stage 3) — 대화록 분석 후 평가 리포트 생성

**근거:**
- 비용 94% 절감 ($2.20 → ~$0.10/회)
- API 키 1개(`GOOGLE_API_KEY`)만 관리
- Gemini Flash의 JSON 구조화 출력 성능이 면접 시나리오 설계에 충분
- 그라운딩 리서치와 동일 벤더로 컨텍스트 전달 최적화

**결과:**
- 장점: 운영 단순화, 비용 대폭 절감, 단일 SDK(`@google/genai`)
- 장점: 그라운딩 리서치로 환각 감소, 현실감 있는 질문 생성 유지
- 단점: 단일 벤더 의존 (Google AI 장애 시 전체 서비스 중단)
- 트레이드오프: Claude의 구조화 분석 품질 → Gemini Flash의 비용 효율로 대체

---

## ADR-002: 턴제 텍스트 채팅 면접 (Stateless)

**상태:** 채택 (ADR-002-v1 대체 — OpenAI Realtime WebRTC)

**맥락:**
초기 버전은 OpenAI Realtime API + WebRTC로 실시간 음성 면접을 구현했으나, 비용이 높고($1.70/회), 브라우저 마이크 권한 문제, WebRTC 연결 불안정 등의 이슈가 있었다.

**결정:**
Gemini `generateContent()` 기반 Stateless 턴제 텍스트 채팅으로 교체.

**API 설계:**
```
POST /api/chat
Request:  { interviewSetup, history: [{role, text}...], userMessage }
Response: { reply, isInterviewEnd, _chatMetrics }
```

**근거:**
- Stateless: 매 요청에 전체 대화 이력 포함 → 서버 세션 관리 불필요
- 서버리스 배포 완전 호환 (WebSocket/WebRTC 불필요)
- 마이크 권한 문제 제거 (텍스트 입력 기본, STT 선택)
- 면접 품질 유지: 시스템 프롬프트에 꼬리질문 가이드, concern_signal 모니터링, `[INTERVIEW_END]` 토큰 포함
- 브라우저 Web Speech API로 선택적 음성 입력 지원

**결과:**
- 장점: 구현 복잡도 대폭 감소 (WebRTC 제거), 비용 ~97% 절감
- 장점: 모든 브라우저에서 작동 (WebRTC/마이크 의존성 제거)
- 단점: 실시간 음성 대화의 몰입감 감소
- 단점: 턴당 1-3초 응답 지연 (Gemini API 호출)
- 단점: 대화 이력이 길어지면 입력 토큰 증가 (10턴 기준 ~50K 토큰)

---

## ADR-003: 3D 아바타 표정/자세 애니메이션

**상태:** 채택 (ADR-003-v1 수정 — 립싱크 제거)

**맥락:**
초기 버전은 `@met4citizen/talkinghead` 라이브러리로 오디오 기반 실시간 립싱크를 구현했으나, 텍스트 채팅 전환으로 오디오 파이프라인이 제거되었다.

**결정:**
ReadyPlayerMe GLB 모델 + Mixamo 애니메이션 기반 표정/자세 애니메이션만 유지:
- `speaking` 상태: TalkingOne/TalkingTwo/TalkingThree 애니메이션 + 사인파 기반 턱 애니메이션
- `listening` 상태: HappyIdle 애니메이션 + 중립 표정
- `idle` 상태: Idle 애니메이션 + 중립 표정
- 눈 깜빡임: 1~5초 랜덤 간격, 200ms 지속
- 상태별 표정 프리셋 (STATE_EXPRESSION_MAP)으로 자연스러운 전환

**결과:**
- 장점: 오디오 파이프라인 완전 제거로 코드 단순화
- 장점: TalkingHead 라이브러리 의존성 약화 (wawa-lipsync 불필요)
- 장점: WebGL만으로 동작 (WebAudio 불필요)
- 단점: 립싱크 없이 단순 턱 애니메이션으로 시각적 현실감 감소

---

## ADR-004: Zustand + Immer 상태 관리

**상태:** 채택

**맥락:**
면접 세션 전체에 걸쳐 이력서, 공고, 분석 결과, 대화록, 평가 등 다양한 상태를 관리해야 한다. 페이지 간 네비게이션에서도 상태가 유지되어야 한다.

**결정:**
Zustand + Immer + subscribeWithSelector 조합을 채택.

**근거:**
- Zustand: 보일러플레이트 최소, React 외부에서도 `getState()` 접근 가능
- Immer: 중첩 객체 업데이트를 안전하게 처리
- subscribeWithSelector: 특정 상태 변화만 구독 (아바타 무드 전환 등)
- sessionStorage 연동으로 새로고침 시에도 상태 복원

**결과:**
- 장점: 비동기 콜백에서 `useInterviewStore.getState()`로 직접 상태 접근 가능
- 장점: Immer로 transcript 배열 push 등 뮤터블 패턴 안전하게 사용

---

## ADR-005: Zod 스키마 기반 LLM 출력 검증

**상태:** 채택

**맥락:**
Gemini의 JSON 출력이 기대한 구조와 다를 수 있다. 면접 시나리오와 평가 리포트의 구조가 보장되지 않으면 UI가 깨진다.

**결정:**
Zod 4 스키마로 모든 LLM JSON 출력을 런타임 검증.

**근거:**
- `InterviewSetupSchema`: 면접 설정 전체 구조 (회사 분석, 질문 5개, 면접관 등)
- `EvaluationSchema`: 평가 리포트 구조 (등급, 역량 레이더, 질문별 점수 등)
- TypeScript 타입 자동 추론 (`z.infer<typeof Schema>`)
- 실패 시 명확한 에러 메시지

**결과:**
- 장점: LLM 출력 구조 보장, 런타임 타입 안전성
- 장점: 질문 수 제약 (`.min(5).max(5)`) 등 비즈니스 규칙 강제
- 단점: 스키마와 프롬프트의 JSON 가이드를 동기화해야 하는 유지보수 부담

---

## ADR-006: `geminiGenerateJSON()` 공통 헬퍼

**상태:** 채택 (ADR-006-v1 대체 — 이중 오디오 경로)

**맥락:**
텍스트 채팅 전환으로 오디오 이중 경로(HTMLAudioElement + TalkingHead)가 불필요해졌다. 대신 Stage 0, 1, 3에서 반복되는 Gemini JSON 생성 패턴을 공통화할 필요가 생겼다.

**결정:**
`lib/gemini.ts`에 `geminiGenerateJSON()` 헬퍼 함수 추가:

```typescript
export async function geminiGenerateJSON(params: {
  systemPrompt: string;
  userMessage: string;
  maxOutputTokens?: number;
  temperature?: number;
}): Promise<{
  text: string;
  promptTokenCount: number;
  candidatesTokenCount: number;
  finishReason: string;
}>
```

**근거:**
- 마크다운 코드 펜스(```json) 자동 제거
- `usageMetadata`에서 토큰 카운트 자동 추출
- `finishReason` 자동 추출
- Stage 0, 1, 3에서 동일한 패턴 재사용

**결과:**
- 장점: API Route 코드 간소화 (30-40줄 → 5줄)
- 장점: 토큰 추출, 에러 처리 등 보일러플레이트 제거

---

## ADR-007: Turbopack 호환성 패치 (postinstall)

**상태:** 채택

**맥락:**
`@met4citizen/talkinghead` 라이브러리가 `lipsyncGetProcessor()` 메서드에서 런타임 계산 경로로 `import(moduleName)`을 호출한다. Turbopack은 정적 분석이 불가능한 동적 import를 빌드 에러로 처리한다 (webpack은 경고만 표시).

**결정:**
`scripts/patch-talkinghead.mjs` postinstall 스크립트로 동적 import를 정적 import 맵으로 교체.

**패치 내용:**
```javascript
// Before (런타임 계산 — Turbopack 에러)
import(path + 'lipsync-' + lang + '.mjs')

// After (정적 맵 — Turbopack 호환)
const loaders = {
  'en': () => import('./lipsync-en.mjs'),
  'fi': () => import('./lipsync-fi.mjs'),
  // ...
};
loaders[lang]?.()
```

**결과:**
- 장점: `npm install` 시 자동 적용, Turbopack과 webpack 모두 호환
- 장점: 라이브러리 동작 변경 없음 (동일한 기능)
- 단점: 라이브러리 업데이트 시 패치 호환성 확인 필요

---

## ADR-008: IndexedDB 기반 파이프라인 모니터링

**상태:** 채택

**맥락:**
LLM 파이프라인의 각 단계별 입출력, 토큰 사용량, 지연 시간 등을 추적할 필요가 있었다. 서버 사이드 로깅은 serverless 환경에서 어렵고, 개발 중 브라우저에서 직접 확인하는 것이 편리하다.

**결정:**
Dexie (IndexedDB) 기반 클라이언트 사이드 모니터링 + `/dev/monitor` 대시보드:
- `llmSpans`: 각 LLM 호출의 프롬프트, 응답, 토큰, 지연 시간
- `pipelineLogs`: 파이프라인 전체 로그 (traceId 기반)
- `realtimeEvents`: 채팅 이벤트 추적
- `errors`: 구조화된 에러 로그

**근거:**
- TTL 7일 + LRU 5세션 기반 자동 정리
- 개발 전용 (`/dev/monitor`, `/dev/grounding`)
- 프로덕션 빌드에서도 데이터 수집은 되지만 대시보드는 개발용

**결과:**
- 장점: 브라우저에서 파이프라인 전체 흐름 시각화
- 장점: LLM 프롬프트/응답 원문 확인 가능
- 단점: 클라이언트 사이드만 — 서버 로그와 불일치 가능

---

## 변경 이력

| 날짜 | ADR | 변경 |
|------|-----|------|
| 2026-02-21 | 001-007 | 초기 ADR 작성 (해커톤 MVP) |
| 2026-02-22 | 001, 002, 003, 006 | Gemini 단일 벤더 전환 — 멀티 LLM → Gemini Flash, WebRTC 음성 → 텍스트 채팅, 립싱크 제거, 오디오 이중 경로 → geminiGenerateJSON 헬퍼 |
| 2026-02-22 | 008 | 신규 — IndexedDB 기반 파이프라인 모니터링 |
