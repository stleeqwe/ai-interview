# ADR.md — 아키텍처 결정 기록

## ADR-001: 멀티 LLM 파이프라인 설계

**상태:** 채택

**맥락:**
면접 시나리오 생성에 단일 LLM을 사용하면 환각(hallucination)과 최신 정보 부재 문제가 발생한다. 회사의 최근 기술 동향, 업계 트렌드 같은 실시간 정보가 필요하다.

**결정:**
3개의 LLM을 파이프라인으로 연결하는 구조를 채택:
1. **Claude Sonnet** (Stage 0) — 이력서/공고 분석 후 웹 리서치 지시문 생성
2. **Gemini Flash** (Grounding) — Google Search 기반 웹 리서치 수행
3. **Claude Sonnet** (Stage 1) — 리서치 결과 + 분석을 종합하여 면접 시나리오 설계
4. **GPT Realtime** (면접 진행) — 실시간 음성 대화
5. **Gemini Flash** (Stage 3) — 대화록 분석 후 평가 리포트 생성

**결과:**
- 장점: 각 LLM의 강점 활용 (Claude=구조화 분석, Gemini=웹 검색, GPT=실시간 음성)
- 장점: 그라운딩 리서치로 환각 감소, 현실감 있는 질문 생성
- 단점: API 호출 증가로 생성 시간 증가 (~2-3분)
- 단점: 3개 API 키 관리 필요

---

## ADR-002: OpenAI Realtime API + WebRTC 선택

**상태:** 채택

**맥락:**
실시간 음성 면접을 구현하기 위해 TTS/STT + 일반 LLM API vs. OpenAI Realtime API를 비교 검토했다.

**결정:**
OpenAI Realtime API (WebRTC 모드)를 채택.

**근거:**
- 양방향 오디오를 단일 API로 처리 (STT + LLM + TTS 통합)
- 서버 VAD로 자연스러운 턴테이킹 (발화 감지 → 자동 응답)
- WebRTC 기반이므로 별도 웹소켓 서버 불필요
- Ephemeral client secret으로 클라이언트에서 직접 연결 (서버 프록시 불필요)

**결과:**
- 장점: 구현 복잡도 대폭 감소, 지연 시간 최소화
- 장점: 서버리스 배포 가능 (세션 발급만 서버에서 처리)
- 단점: OpenAI 모델만 사용 가능 (면접 진행 단계)
- 단점: 비용이 높은 편 (Realtime API 가격)

---

## ADR-003: @met4citizen/talkinghead 3D 아바타

**상태:** 채택

**맥락:**
면접관 아바타로 2D 이미지, Lottie 애니메이션, 3D 모델 등의 선택지가 있었다. 몰입감 있는 면접 경험을 위해 립싱크가 가능한 3D 아바타가 필요했다.

**결정:**
`@met4citizen/talkinghead` 라이브러리를 채택하여 ReadyPlayerMe GLB 모델 기반 3D 아바타를 구현.

**근거:**
- Three.js 기반으로 GLB 모델 로딩 및 립싱크 지원
- `streamAudio()` API로 실시간 PCM 오디오 → 립싱크 변환
- 다양한 무드(neutral, happy 등)와 제스처 지원
- MIT 라이선스

**결과:**
- 장점: OpenAI Realtime API의 오디오 델타를 실시간 립싱크로 변환 가능
- 장점: ReadyPlayerMe 아바타를 자유롭게 교체 가능
- 단점: 라이브러리 내부의 동적 import가 Turbopack과 호환 안됨 → postinstall 패치 필요
- 단점: WebGL 필수 (미지원 시 2D 폴백으로 대응)

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
- 장점: WebRTC 콜백에서 `useInterviewStore.getState()`로 직접 상태 접근 가능
- 장점: Immer로 transcript 배열 push 등 뮤터블 패턴 안전하게 사용
- 단점: HTMLAudioElement, TalkingHead 인스턴스 등 DOM 객체는 Immer draft 우회 필요

---

## ADR-005: Zod 스키마 기반 LLM 출력 검증

**상태:** 채택

**맥락:**
Claude의 JSON 출력이 기대한 구조와 다를 수 있다. 면접 시나리오와 평가 리포트의 구조가 보장되지 않으면 UI가 깨진다.

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

## ADR-006: 음성 출력 이중 경로 (WebRTC + TalkingHead)

**상태:** 채택

**맥락:**
OpenAI Realtime API는 WebRTC `ontrack`으로 오디오 스트림을 전송하고, 동시에 DataChannel로 `response.audio.delta` 이벤트(base64 PCM)도 전송한다. TalkingHead 립싱크는 PCM 데이터가 필요하다.

**결정:**
이중 경로 설계 — HTMLAudioElement(폴백) + TalkingHead(립싱크):
1. 기본: HTMLAudioElement로 WebRTC 오디오 재생 (TalkingHead 로딩 전 폴백)
2. TalkingHead 준비 완료 시: audioEl을 mute하고 DataChannel PCM → TalkingHead로 전환

**근거:**
- TalkingHead 로딩에 수 초 소요 → 그 사이 면접관 음성이 안 들리는 문제 방지
- TalkingHead가 준비되면 자동으로 전환하여 이중 재생 방지

**결과:**
- 장점: TalkingHead 로딩 상태와 무관하게 항상 음성 출력 보장
- 장점: 3D 아바타 크래시 시에도 음성은 계속 들림

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

## 변경 이력

| 날짜 | ADR | 변경 |
|------|-----|------|
| 2026-02-21 | 001-007 | 초기 ADR 작성 (해커톤 MVP) |
