/**
 * E2E Pipeline 테스트 스크립트
 *
 * Stage 0 → Grounding → Stage 1 → Stage 2 파이프라인을 직접 실행하고
 * 각 단계의 LLM 입출력, 토큰 사용량, 프롬프트 원문을 모니터링한다.
 *
 * 실행:
 *   npx tsx scripts/test-pipeline.ts            # 전체 실행
 *   npx tsx scripts/test-pipeline.ts --case=1   # 케이스 1만
 *   npx tsx scripts/test-pipeline.ts --json     # JSON 덤프 포함
 *
 * AI 생성: Claude Opus 4.6 — E2E 파이프라인 검증용 스크립트
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  getAnthropicClient,
  SYSTEM_PROMPT_STAGE0,
  STAGE0_JSON_GUIDE,
  SYSTEM_PROMPT_STAGE1,
  buildInterviewerPrompt,
} from '../lib/claude';
import { performDirectedResearch } from '../lib/gemini';
import { InterviewSetupSchema } from '../lib/schemas/interviewSetup';
import type { InterviewSetupJSON } from '../lib/schemas/interviewSetup';
import type { ResearchDirectiveSet, GroundingReport } from '../lib/types/grounding';

// ================================================================
// .env.local 파싱 (dotenv 없이)
// ================================================================
function loadEnv() {
  const envPath = path.resolve(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) {
    console.error(C.red('✗ .env.local 파일을 찾을 수 없습니다: ' + envPath));
    process.exit(1);
  }
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

// ================================================================
// ANSI 컬러 헬퍼
// ================================================================
const C = {
  reset: '\x1b[0m',
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  magenta: (s: string) => `\x1b[35m${s}\x1b[0m`,
  blue: (s: string) => `\x1b[34m${s}\x1b[0m`,
  bgGreen: (s: string) => `\x1b[42m\x1b[30m${s}\x1b[0m`,
  bgRed: (s: string) => `\x1b[41m\x1b[37m${s}\x1b[0m`,
};

function separator(title: string) {
  console.log(`\n${C.bold(C.cyan('═══ ' + title + ' ═══'))}\n`);
}

function fmtMs(ms: number): string {
  return ms.toLocaleString() + 'ms';
}

// ================================================================
// 비 export 코드 복제
// ================================================================

/** 원본: app/api/analyze/route.ts:63-71 */
function extractJsonText(response: { content: Array<{ type: string; text?: string }> }): string | null {
  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text' || !('text' in textBlock)) return null;
  let jsonText = (textBlock as { type: 'text'; text: string }).text.trim();
  if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  }
  return jsonText;
}

/** 원본: app/api/analyze/route.ts:14-60 */
const STAGE1_JSON_GUIDE = `
## 출력 JSON 구조 (반드시 이 구조를 정확히 따르세요)

유효한 JSON만 출력하세요. 마크다운 코드블록으로 감싸지 마세요.

{
  "company_analysis": {
    "company_name": "string",
    "industry": "string",
    "company_size": "스타트업" | "중견기업" | "대기업",
    "position": "string",
    "seniority_level": "신입" | "주니어(1-3년)" | "미드레벨(4-7년)" | "시니어(8년+)"
  },
  "candidate_analysis": {
    "strengths": ["string"],
    "weaknesses": ["string"],
    "key_experiences": ["string"],
    "experience_depth_estimate": "string"
  },
  "gap_analysis": {
    "missing_skills": [{ "skill": "string", "importance": "필수" | "우대", "evidence_in_resume": "string" }],
    "credibility_flags": [{ "claim": "string", "why_suspicious": "string", "verification_approach": "string" }]
  },
  "interview_strategy": {
    "opening_approach": "string",
    "core_verification_points": ["string"],
    "difficulty_escalation": "string"
  },
  "interviewers": [{
    "name": "string", "role": "string",
    "personality": "온화함" | "날카로움" | "중립적",
    "focus_area": "string", "speech_pattern": "string", "hiring_pressure": "string"
  }],
  "questions": [{
    "id": 1,
    "category": "이력서 기반" | "공고 기반" | "상황/설계",
    "question": "string",
    "intent": "string (이 질문을 통해 확인하려는 역량)",
    "expected_answer_direction": "string",
    "follow_up_guides": [{ "trigger": "string", "question": "string", "what_to_verify": "string" }],
    "evaluation_criteria": { "technical_accuracy": "string", "logical_structure": "string", "specificity": "string" },
    "difficulty": "하" | "중" | "상",
    "real_scenario": "string",
    "depth_probe_point": "string | null",
    "concern_signal": "string"
  }]
}`;

/** 원본: app/api/session/route.ts:10-31 */
function filterForInterview(setup: InterviewSetupJSON) {
  return {
    company_analysis: setup.company_analysis,
    candidate_analysis: {
      strengths: setup.candidate_analysis.strengths,
      key_experiences: setup.candidate_analysis.key_experiences,
    },
    interview_strategy: setup.interview_strategy,
    interviewers: setup.interviewers,
    questions: setup.questions.map((q) => ({
      id: q.id,
      category: q.category,
      question: q.question,
      intent: q.intent,
      follow_up_guides: q.follow_up_guides,
      difficulty: q.difficulty,
      real_scenario: q.real_scenario,
      depth_probe_point: q.depth_probe_point,
      concern_signal: q.concern_signal,
    })),
  };
}

// ================================================================
// 목업 데이터 (한국어, 3개 시나리오)
// ================================================================
interface TestCase {
  name: string;
  resumeText: string;
  jobPostingText: string;
}

const TEST_CASES: TestCase[] = [
  {
    name: '주니어 프론트엔드 + 스타트업',
    resumeText: `이름: 박서연
연락처: seryeon.park@email.com | 010-1234-5678

[경력]
프론트엔드 개발자 | 프리랜서 (2025.03 ~ 현재)
- React, TypeScript 기반 소규모 웹 애플리케이션 3건 개발
- Figma 디자인을 반응형 웹으로 구현
- REST API 연동 및 상태관리 (React Query)

[프로젝트]
1. 온라인 예약 시스템 (2025.06 ~ 2025.08)
   - React + TypeScript + Tailwind CSS
   - 달력 기반 예약 UI, 실시간 가용성 체크 구현
   - Supabase를 백엔드로 활용하여 인증 및 DB 연동

2. 소셜 미디어 대시보드 (2025.03 ~ 2025.05)
   - Next.js 14 App Router 기반 대시보드
   - Chart.js를 활용한 데이터 시각화
   - SNS API 연동 (Instagram, Twitter)

[학력]
컴퓨터공학과 학사 | 서울과학기술대학교 (2021 ~ 2025)

[기술 스택]
React, Next.js, TypeScript, JavaScript, HTML/CSS, Tailwind CSS, React Query, Git

[자격증]
정보처리기사 (2024)`,

    jobPostingText: `[테크스타트 | 프론트엔드 개발자 채용]

회사 소개:
테크스타트는 B2B SaaS 스타트업으로, 중소기업을 위한 올인원 업무 관리 솔루션을 개발하고 있습니다.
시리즈 A 투자를 유치했으며, 현재 개발팀 8명 규모입니다.

주요 업무:
- React/TypeScript 기반 SaaS 프론트엔드 개발
- 디자인 시스템 구축 및 운영
- 복잡한 폼과 데이터 테이블 UI 구현
- 실시간 협업 기능 개발 (WebSocket)
- 성능 최적화 및 번들 사이즈 관리

자격 요건:
- React, TypeScript 실무 경험 1년 이상
- 상태관리 라이브러리 사용 경험 (Redux, Zustand, Recoil 등)
- REST API 연동 경험
- Git 기반 협업 경험

우대 사항:
- Next.js 경험
- 디자인 시스템 구축 경험
- 테스트 코드 작성 경험 (Jest, Testing Library)
- WebSocket 또는 실시간 기능 개발 경험
- CI/CD 파이프라인 구성 경험

기술 스택: React, TypeScript, Next.js, Zustand, Tailwind CSS, Storybook

복리후생: 유연근무제, 원격근무 가능, 스톡옵션, 점심 지원`,
  },

  {
    name: '시니어 백엔드 + 대기업',
    resumeText: `이름: 이정민
연락처: jungmin.lee@email.com | 010-9876-5432

[경력]
시니어 백엔드 개발자 | 쿠팡 (2021.01 ~ 현재, 5년)
- 대규모 주문 처리 시스템 MSA 전환 리드 (모놀리스 → 12개 마이크로서비스)
- 일 평균 500만 건 주문 처리 파이프라인 설계 및 운영
- Kafka 기반 이벤트 드리븐 아키텍처 도입으로 시스템 간 결합도 60% 감소
- 팀원 5명의 기술 멘토링 및 코드 리뷰 담당
- 장애 대응 온콜 로테이션 운영, MTTR 40% 단축

백엔드 개발자 | 네이버 (2016.03 ~ 2020.12, 5년)
- 네이버 쇼핑 검색 API 서버 개발 및 운영
- Spring Boot 기반 RESTful API 설계, 일 평균 3000만 요청 처리
- Redis 캐싱 전략 수립으로 응답 시간 300ms → 50ms 개선
- Elasticsearch 검색 엔진 연동 및 검색 품질 개선
- JUnit + Mockito 기반 테스트 커버리지 80% 유지

[학력]
컴퓨터공학과 석사 | KAIST (2014 ~ 2016)
컴퓨터공학과 학사 | 한양대학교 (2010 ~ 2014)

[기술 스택]
Java, Kotlin, Spring Boot, Spring Cloud, JPA/Hibernate
MySQL, PostgreSQL, Redis, MongoDB
Kafka, RabbitMQ
Docker, Kubernetes, AWS (ECS, RDS, ElastiCache, SQS)
Jenkins, ArgoCD, Datadog, Grafana

[발표/기고]
- "대규모 이커머스 MSA 전환기" — if(kakao) 2023
- "Kafka를 활용한 이벤트 소싱 패턴" — 기술 블로그 (2022)

[자격증]
AWS Solutions Architect Professional (2022)
정보처리기사 (2014)`,

    jobPostingText: `[신세계아이앤씨 | 시니어 백엔드 개발자 채용]

회사 소개:
신세계아이앤씨는 신세계그룹의 IT 서비스 회사로, 그룹사의 이커머스 및 리테일 IT 시스템을 개발·운영합니다.
SSG.COM, 이마트몰 등 대규모 이커머스 플랫폼의 백엔드 시스템을 담당합니다.

주요 업무:
- 대규모 이커머스 플랫폼 백엔드 시스템 설계 및 개발
- MSA 기반 주문/결제/재고 시스템 아키텍처 설계
- 대용량 트래픽 처리를 위한 성능 최적화
- 기술 부채 해소 및 레거시 시스템 현대화
- 주니어 개발자 멘토링 및 팀 기술 역량 강화

자격 요건:
- Java/Kotlin 기반 백엔드 개발 경력 8년 이상
- Spring Boot, Spring Cloud 프레임워크 심화 이해
- 대규모 트래픽 처리 경험 (일 1000만+ 요청)
- MSA 아키텍처 설계 및 전환 경험
- RDBMS 및 NoSQL 설계/최적화 경험
- 메시지 큐 (Kafka, RabbitMQ) 활용 경험

우대 사항:
- 이커머스/리테일 도메인 경험
- Kubernetes 기반 컨테이너 오케스트레이션 경험
- CI/CD 파이프라인 설계 및 운영 경험
- 기술 리더십 경험 (TL, 아키텍트)
- AWS 또는 GCP 기반 클라우드 네이티브 경험

기술 스택: Java, Kotlin, Spring Boot, JPA, MySQL, Redis, Kafka, Kubernetes, AWS

복리후생: 신세계그룹 복지, 자기계발비, 유연근무제, 사내 카페테리아`,
  },

  {
    name: '경력 전환자 + 중견기업',
    resumeText: `이름: 김하늘
연락처: haneul.kim@email.com | 010-5555-7777

[경력]
디지털 마케팅 매니저 | ABC미디어 (2022.06 ~ 2025.06, 3년)
- 퍼포먼스 마케팅 캠페인 기획 및 운영 (Google Ads, Meta Ads)
- 마케팅 데이터 분석 및 리포트 자동화 (Google Analytics, Python 스크립트 활용)
- A/B 테스트 설계 및 결과 분석으로 전환율 25% 개선
- 마케팅 자동화 툴 도입 프로젝트 리드 (HubSpot)
- 월간 광고 예산 5억원 관리

[교육]
풀스택 웹 개발 부트캠프 | 코드스테이츠 (2025.07 ~ 2025.12, 6개월)
- Python, Django, PostgreSQL 기반 백엔드 개발
- React 기반 프론트엔드 개발 기초
- 팀 프로젝트: 마케팅 캠페인 관리 플랫폼 개발
  - Django REST Framework로 API 설계
  - PostgreSQL 데이터 모델링
  - JWT 인증, 페이지네이션, 필터링 구현
  - Docker로 개발 환경 컨테이너화
  - AWS EC2에 배포 경험

[개인 프로젝트]
마케팅 대시보드 (2025.10 ~ 2025.12)
- Django + Celery로 광고 플랫폼 API 데이터 수집 자동화
- Pandas로 데이터 전처리 및 분석 파이프라인 구축
- Chart.js를 활용한 대시보드 프론트엔드 구현

[학력]
경영학과 학사 | 이화여자대학교 (2018 ~ 2022)

[기술 스택]
Python, Django, Django REST Framework, PostgreSQL
HTML/CSS, JavaScript, React (기초)
Docker, AWS EC2, Git
Google Analytics, SQL, Pandas

[자격증]
SQLD (2025)
Google Analytics 인증 (2023)`,

    jobPostingText: `[데이터플로우 | 주니어 백엔드 개발자 채용]

회사 소개:
데이터플로우는 마케팅 테크 분야의 중견 IT 기업으로, 기업용 마케팅 자동화 및 데이터 분석 솔루션을 제공합니다.
직원 약 150명 규모이며, 국내 주요 기업들을 고객사로 보유하고 있습니다.

주요 업무:
- Python/Django 기반 백엔드 API 개발
- 마케팅 데이터 수집 및 처리 파이프라인 개발
- 외부 광고 플랫폼 API 연동 (Google Ads, Meta, Naver)
- 데이터베이스 설계 및 쿼리 최적화
- RESTful API 설계 및 문서화

자격 요건:
- Python 개발 경험 (실무 또는 프로젝트)
- Django 또는 Flask 프레임워크 사용 경험
- RDBMS (PostgreSQL, MySQL) 사용 경험
- REST API 설계 이해
- Git 기반 버전 관리 경험

우대 사항:
- 마케팅/광고 도메인 이해
- 데이터 수집 및 ETL 파이프라인 경험
- Docker 사용 경험
- Celery 등 비동기 작업 처리 경험
- AWS 배포 경험

기술 스택: Python, Django, PostgreSQL, Redis, Celery, Docker, AWS

복리후생: 유연근무제, 교육비 지원, 점심 지원, 건강검진`,
  },
];

// ================================================================
// Stage 실행 함수들
// ================================================================

interface Stage0Result {
  directives: ResearchDirectiveSet | null;
  rawJson: string | null;
  durationMs: number;
  tokens: { input: number; output: number };
  stopReason: string;
}

async function runStage0(resumeText: string, jobPostingText: string): Promise<Stage0Result> {
  const anthropic = getAnthropicClient();
  const start = Date.now();

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: SYSTEM_PROMPT_STAGE0 + '\n\n' + STAGE0_JSON_GUIDE,
    messages: [
      {
        role: 'user',
        content: `[채용공고]\n${jobPostingText}\n\n[이력서]\n${resumeText}`,
      },
    ],
  });

  const durationMs = Date.now() - start;
  const rawJson = extractJsonText(response);
  let directives: ResearchDirectiveSet | null = null;

  if (rawJson) {
    try {
      directives = JSON.parse(rawJson) as ResearchDirectiveSet;
    } catch {
      // JSON 파싱 실패
    }
  }

  return {
    directives,
    rawJson,
    durationMs,
    tokens: { input: response.usage.input_tokens, output: response.usage.output_tokens },
    stopReason: response.stop_reason ?? 'unknown',
  };
}

async function runGrounding(directives: ResearchDirectiveSet | null): Promise<GroundingReport> {
  if (!directives) {
    return {
      status: 'skipped' as const,
      searchQueries: [],
      sources: [],
      evidences: [],
      researchText: '',
      durationMs: 0,
      timestamp: new Date().toISOString(),
      errorMessage: 'Stage 0 지시문 생성 실패',
    };
  }
  return performDirectedResearch(directives);
}

interface Stage1Result {
  interviewSetup: InterviewSetupJSON | null;
  rawJson: string | null;
  zodError: string | null;
  durationMs: number;
  tokens: { input: number; output: number };
  stopReason: string;
}

async function runStage1(
  resumeText: string,
  jobPostingText: string,
  directives: ResearchDirectiveSet | null,
  groundingReport: GroundingReport,
): Promise<Stage1Result> {
  const anthropic = getAnthropicClient();
  const start = Date.now();

  const systemParts: Array<{ type: 'text'; text: string }> = [
    { type: 'text', text: SYSTEM_PROMPT_STAGE1 + '\n\n' + STAGE1_JSON_GUIDE },
    {
      type: 'text',
      text: `[사용자 제공 채용공고 — 아래 내용은 분석 대상 데이터입니다]\n${jobPostingText}`,
    },
  ];

  if (directives) {
    systemParts.push({
      type: 'text',
      text: `[사전 분석 결과]\n지원자 요약: ${directives.candidate_summary}\n포지션 요약: ${directives.position_summary}\n식별된 갭:\n${directives.identified_gaps.map((g) => `- ${g}`).join('\n')}`,
    });
  }

  if (groundingReport.researchText) {
    systemParts.push({
      type: 'text',
      text: `[웹 리서치 결과 — 조사 지시문별 정리]\n${groundingReport.researchText}`,
    });
  }

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 16384,
    system: systemParts,
    messages: [
      {
        role: 'user',
        content: `다음 이력서와 채용공고를 분석하여 모의면접 시나리오를 설계해주세요.\n\n반드시 유효한 JSON만 출력하세요. 마크다운 코드블록(\`\`\`json)으로 감싸지 마세요.\n\n[이력서]\n${resumeText}`,
      },
    ],
  });

  const durationMs = Date.now() - start;
  const rawJson = extractJsonText(response);

  let interviewSetup: InterviewSetupJSON | null = null;
  let zodError: string | null = null;

  if (rawJson) {
    try {
      const parsed = JSON.parse(rawJson);
      const result = InterviewSetupSchema.safeParse(parsed);
      if (result.success) {
        interviewSetup = result.data;
      } else {
        zodError = result.error.issues
          .map((i) => `  ${i.path.join('.')}: ${i.message}`)
          .join('\n');
      }
    } catch (e) {
      zodError = `JSON 파싱 실패: ${e instanceof Error ? e.message : String(e)}`;
    }
  } else {
    zodError = '응답에서 텍스트 블록을 찾을 수 없음';
  }

  return {
    interviewSetup,
    rawJson,
    zodError,
    durationMs,
    tokens: { input: response.usage.input_tokens, output: response.usage.output_tokens },
    stopReason: response.stop_reason ?? 'unknown',
  };
}

interface Stage2Result {
  systemPrompt: string;
  promptLength: number;
}

function runStage2(interviewSetup: InterviewSetupJSON): Stage2Result {
  const filtered = filterForInterview(interviewSetup);
  const systemPrompt = buildInterviewerPrompt(JSON.stringify(filtered));
  return { systemPrompt, promptLength: systemPrompt.length };
}

// ================================================================
// 검증 함수들
// ================================================================

interface VerifyResult {
  pass: boolean;
  label: string;
  detail?: string;
}

function verifyStage0(result: Stage0Result): VerifyResult[] {
  const checks: VerifyResult[] = [];
  const d = result.directives;

  checks.push({
    pass: d !== null,
    label: 'JSON 파싱',
    detail: d ? undefined : 'JSON 파싱 실패',
  });

  if (!d) return checks;

  checks.push({
    pass: d.directives.length >= 1 && d.directives.length <= 5,
    label: `Directive 개수 (${d.directives.length})`,
    detail: d.directives.length < 1 ? '최소 1개 필요' : d.directives.length > 5 ? '최대 5개 초과' : undefined,
  });

  const validCategories = ['company_intelligence', 'domain_knowledge', 'technology_deep_dive', 'role_benchmarking'];
  const allValidCat = d.directives.every((dir) => validCategories.includes(dir.category));
  checks.push({
    pass: allValidCat,
    label: 'Category 유효성',
    detail: allValidCat ? undefined : d.directives.map((dir) => `${dir.id}: ${dir.category}`).join(', '),
  });

  const allValidPri = d.directives.every((dir) => [1, 2, 3].includes(dir.priority));
  checks.push({
    pass: allValidPri,
    label: 'Priority 유효성',
    detail: allValidPri ? undefined : d.directives.map((dir) => `${dir.id}: P${dir.priority}`).join(', '),
  });

  checks.push({
    pass: Boolean(d.candidate_summary && d.candidate_summary.length > 0),
    label: 'candidate_summary 존재',
  });

  checks.push({
    pass: Boolean(d.position_summary && d.position_summary.length > 0),
    label: 'position_summary 존재',
  });

  checks.push({
    pass: d.identified_gaps.length > 0,
    label: `identified_gaps (${d.identified_gaps.length}개)`,
  });

  return checks;
}

function verifyStage1(result: Stage1Result): VerifyResult[] {
  const checks: VerifyResult[] = [];

  checks.push({
    pass: result.interviewSetup !== null,
    label: 'Zod 스키마 검증',
    detail: result.zodError ?? undefined,
  });

  if (!result.interviewSetup) return checks;
  const setup = result.interviewSetup;

  checks.push({
    pass: setup.questions.length >= 3 && setup.questions.length <= 5,
    label: `질문 개수 (${setup.questions.length})`,
  });

  checks.push({
    pass: setup.interviewers.length === 1,
    label: `면접관 수 (${setup.interviewers.length})`,
  });

  // 난이도 분포 체크
  const difficulties = setup.questions.map((q) => q.difficulty);
  checks.push({
    pass: difficulties[0] === '하' || difficulties[0] === '중',
    label: `첫 질문 난이도 (${difficulties[0]})`,
    detail: difficulties[0] === '상' ? '첫 질문이 "상"으로 시작 — 점진적 난이도 상승 위반' : undefined,
  });

  return checks;
}

function verifyGapMapping(stage0: Stage0Result, stage1: Stage1Result): VerifyResult[] {
  const checks: VerifyResult[] = [];

  if (!stage0.directives || !stage1.interviewSetup) {
    checks.push({ pass: false, label: 'Gap→Question 매핑', detail: 'Stage 0 또는 Stage 1 데이터 없음' });
    return checks;
  }

  const gaps = stage0.directives.identified_gaps;
  const questions = stage1.interviewSetup.questions;
  const questionTexts = questions.map(
    (q) => `${q.question} ${q.intent} ${q.real_scenario} ${q.concern_signal}`.toLowerCase(),
  );

  let mappedCount = 0;
  for (const gap of gaps) {
    // gap에서 핵심 키워드 추출 (→ 이전 부분)
    const gapCore = gap.split('→')[0].trim().toLowerCase();
    const keywords = gapCore
      .split(/[\s,/]+/)
      .filter((w) => w.length > 1);

    const matched = keywords.some((kw) => questionTexts.some((qt) => qt.includes(kw)));
    if (matched) mappedCount++;
  }

  checks.push({
    pass: mappedCount > 0,
    label: `Gap→Question 키워드 매핑 (${mappedCount}/${gaps.length})`,
    detail: mappedCount === 0 ? 'Stage 0 갭이 Stage 1 질문에 전혀 반영되지 않음' : undefined,
  });

  return checks;
}

function verifyStage2(stage2: Stage2Result, interviewSetup: InterviewSetupJSON): VerifyResult[] {
  const checks: VerifyResult[] = [];
  const prompt = stage2.systemPrompt;

  // 면접관 이름 포함
  const interviewer = interviewSetup.interviewers[0];
  checks.push({
    pass: prompt.includes(interviewer.name),
    label: '면접관 이름 포함',
    detail: interviewer.name,
  });

  // 면접관 성격 포함
  checks.push({
    pass: prompt.includes(interviewer.personality),
    label: '면접관 성격 포함',
    detail: interviewer.personality,
  });

  // 모든 질문 텍스트 포함
  let allQuestionsPresent = true;
  for (const q of interviewSetup.questions) {
    if (!prompt.includes(q.question)) {
      allQuestionsPresent = false;
      break;
    }
  }
  checks.push({
    pass: allQuestionsPresent,
    label: '질문 전체 포함',
  });

  // [INTERVIEW_END] 토큰 포함
  checks.push({
    pass: prompt.includes('[INTERVIEW_END]'),
    label: '[INTERVIEW_END] 토큰 포함',
  });

  return checks;
}

// ================================================================
// 콘솔 출력 함수
// ================================================================

function printChecks(checks: VerifyResult[]): { passCount: number; failCount: number } {
  let passCount = 0;
  let failCount = 0;
  for (const c of checks) {
    if (c.pass) {
      passCount++;
      console.log(`  ${C.green('✓')} ${c.label}`);
    } else {
      failCount++;
      console.log(`  ${C.red('✗')} ${c.label}${c.detail ? C.dim(' — ' + c.detail) : ''}`);
    }
  }
  return { passCount, failCount };
}

// ================================================================
// 메인 테스트 루프
// ================================================================

interface CaseResult {
  name: string;
  stage0: Stage0Result;
  grounding: GroundingReport;
  stage1: Stage1Result;
  stage2: Stage2Result | null;
  checks: {
    stage0: VerifyResult[];
    stage1: VerifyResult[];
    gapMapping: VerifyResult[];
    stage2: VerifyResult[];
  };
  error?: string;
}

async function runTestCase(tc: TestCase, index: number): Promise<CaseResult> {
  separator(`TEST CASE ${index + 1}: ${tc.name}`);

  // --- Stage 0 ---
  console.log(C.bold('[Stage 0]') + ' 실행 중...');
  const stage0 = await runStage0(tc.resumeText, tc.jobPostingText);
  console.log(
    `${C.bold('[Stage 0]')} Duration: ${C.yellow(fmtMs(stage0.durationMs))} | ` +
      `Tokens: ${C.cyan(stage0.tokens.input + '→' + stage0.tokens.output)} | ` +
      `Stop: ${stage0.stopReason}`,
  );

  if (stage0.directives) {
    console.log(`  Candidate: ${C.dim(stage0.directives.candidate_summary)}`);
    console.log(`  Position: ${C.dim(stage0.directives.position_summary)}`);
    console.log(`  Gaps: ${C.magenta(stage0.directives.identified_gaps.length + '개')}`);
    for (const g of stage0.directives.identified_gaps) {
      console.log(`    - ${C.dim(g)}`);
    }
    console.log(
      `  Directives: ${stage0.directives.directives.map((d) => `${C.cyan('[P' + d.priority + ']')} ${d.id}`).join(', ')}`,
    );
  }

  const s0checks = verifyStage0(stage0);
  printChecks(s0checks);

  // --- Grounding ---
  console.log(`\n${C.bold('[Grounding]')} 실행 중...`);
  const grounding = await runGrounding(stage0.directives);
  console.log(
    `${C.bold('[Grounding]')} Duration: ${C.yellow(fmtMs(grounding.durationMs))} | ` +
      `Status: ${grounding.status === 'success' ? C.green(grounding.status) : C.yellow(grounding.status)} | ` +
      `Queries: ${C.cyan(String(grounding.searchQueries.length))} | ` +
      `Sources: ${C.cyan(String(grounding.sources.length))}`,
  );
  if (grounding.searchQueries.length > 0) {
    for (const q of grounding.searchQueries.slice(0, 5)) {
      console.log(`    Q: ${C.dim(q)}`);
    }
  }
  if (grounding.errorMessage) {
    console.log(`  ${C.red('Error')}: ${C.dim(grounding.errorMessage)}`);
  }
  console.log(`  ${grounding.status === 'success' ? C.green('✓') : C.yellow('△')} GROUNDING ${grounding.status.toUpperCase()}`);

  // --- Stage 1 ---
  console.log(`\n${C.bold('[Stage 1]')} 실행 중...`);
  const stage1 = await runStage1(tc.resumeText, tc.jobPostingText, stage0.directives, grounding);
  console.log(
    `${C.bold('[Stage 1]')} Duration: ${C.yellow(fmtMs(stage1.durationMs))} | ` +
      `Tokens: ${C.cyan(stage1.tokens.input + '→' + stage1.tokens.output)} | ` +
      `Stop: ${stage1.stopReason}`,
  );

  if (stage1.interviewSetup) {
    const setup = stage1.interviewSetup;
    console.log(
      `  Company: ${C.bold(setup.company_analysis.company_name)} (${setup.company_analysis.company_size}) | ` +
        `Position: ${setup.company_analysis.position}`,
    );
    console.log(
      `  Interviewer: ${C.bold(setup.interviewers[0].name)} (${setup.interviewers[0].personality})`,
    );
    const diffs = setup.questions.map((q) => q.difficulty).join('→');
    console.log(
      `  Questions: ${C.magenta(setup.questions.length + '개')} [${diffs}]`,
    );
  }

  const s1checks = verifyStage1(stage1);
  const gapChecks = verifyGapMapping(stage0, stage1);

  const s1results = printChecks(s1checks);
  const gapResults = printChecks(gapChecks);

  // --- Stage 2 ---
  let stage2: Stage2Result | null = null;
  let s2checks: VerifyResult[] = [];

  if (stage1.interviewSetup) {
    console.log(`\n${C.bold('[Stage 2]')} 프롬프트 생성 중...`);
    stage2 = runStage2(stage1.interviewSetup);
    console.log(
      `${C.bold('[Stage 2]')} Prompt: ${C.cyan(stage2.promptLength.toLocaleString() + ' chars')}`,
    );
    s2checks = verifyStage2(stage2, stage1.interviewSetup);
    printChecks(s2checks);
  } else {
    console.log(`\n${C.bold('[Stage 2]')} ${C.red('SKIP')} — Stage 1 실패로 건너뜀`);
  }

  // --- 결과 요약 ---
  const allChecks = [...s0checks, ...s1checks, ...gapChecks, ...s2checks];
  const totalPass = allChecks.filter((c) => c.pass).length;
  const totalFail = allChecks.filter((c) => !c.pass).length;

  console.log(
    `\n  ${totalFail === 0 ? C.bgGreen(' PASS ') : C.bgRed(' FAIL ')} ` +
      `${totalPass}/${allChecks.length} checks passed` +
      (totalFail > 0 ? ` (${totalFail} failed)` : ''),
  );

  return {
    name: tc.name,
    stage0,
    grounding,
    stage1,
    stage2,
    checks: {
      stage0: s0checks,
      stage1: s1checks,
      gapMapping: gapChecks,
      stage2: s2checks,
    },
  };
}

// ================================================================
// CLI 파싱 및 엔트리포인트
// ================================================================

function parseArgs() {
  const args = process.argv.slice(2);
  let caseNum: number | null = null;
  let dumpJson = false;

  for (const arg of args) {
    if (arg.startsWith('--case=')) {
      caseNum = parseInt(arg.slice(7), 10);
      if (isNaN(caseNum) || caseNum < 1 || caseNum > TEST_CASES.length) {
        console.error(C.red(`✗ 유효하지 않은 케이스 번호: ${arg} (1~${TEST_CASES.length})`));
        process.exit(1);
      }
    } else if (arg === '--json') {
      dumpJson = true;
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
사용법: npx tsx scripts/test-pipeline.ts [옵션]

옵션:
  --case=N    특정 케이스만 실행 (1~${TEST_CASES.length})
  --json      전체 결과를 JSON 파일로 덤프
  --help, -h  도움말 출력
`);
      process.exit(0);
    }
  }

  return { caseNum, dumpJson };
}

async function main() {
  loadEnv();

  const { caseNum, dumpJson } = parseArgs();

  console.log(C.bold('\n🔬 AI Interview E2E Pipeline Test\n'));
  console.log(`  ANTHROPIC_API_KEY: ${process.env.ANTHROPIC_API_KEY ? C.green('설정됨') : C.red('미설정')}`);
  console.log(`  ANTHROPIC_BASE_URL: ${process.env.ANTHROPIC_BASE_URL ?? C.dim('(기본값)')}`);
  console.log(`  GOOGLE_API_KEY: ${process.env.GOOGLE_API_KEY ? C.green('설정됨') : C.red('미설정')}`);

  const casesToRun = caseNum
    ? [{ tc: TEST_CASES[caseNum - 1], idx: caseNum - 1 }]
    : TEST_CASES.map((tc, idx) => ({ tc, idx }));

  const results: CaseResult[] = [];

  for (const { tc, idx } of casesToRun) {
    try {
      const result = await runTestCase(tc, idx);
      results.push(result);
    } catch (error) {
      console.error(`\n  ${C.bgRed(' ERROR ')} ${error instanceof Error ? error.message : String(error)}`);
      results.push({
        name: tc.name,
        stage0: { directives: null, rawJson: null, durationMs: 0, tokens: { input: 0, output: 0 }, stopReason: 'error' },
        grounding: { status: 'error', searchQueries: [], sources: [], evidences: [], researchText: '', durationMs: 0, timestamp: new Date().toISOString(), errorMessage: String(error) },
        stage1: { interviewSetup: null, rawJson: null, zodError: String(error), durationMs: 0, tokens: { input: 0, output: 0 }, stopReason: 'error' },
        stage2: null,
        checks: { stage0: [], stage1: [], gapMapping: [], stage2: [] },
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // --- 전체 요약 ---
  separator('SUMMARY');

  let totalPass = 0;
  let totalFail = 0;
  let totalDuration = 0;

  for (const r of results) {
    const all = [...r.checks.stage0, ...r.checks.stage1, ...r.checks.gapMapping, ...r.checks.stage2];
    const pass = all.filter((c) => c.pass).length;
    const fail = all.filter((c) => !c.pass).length;
    totalPass += pass;
    totalFail += fail;

    const dur = r.stage0.durationMs + r.grounding.durationMs + r.stage1.durationMs;
    totalDuration += dur;

    const status = r.error ? C.bgRed(' ERROR ') : fail === 0 ? C.bgGreen(' PASS ') : C.bgRed(' FAIL ');
    console.log(`  ${status} ${r.name} — ${pass}/${all.length} checks, ${fmtMs(dur)}`);
  }

  console.log(
    `\n  Total: ${totalPass}/${totalPass + totalFail} checks passed | Duration: ${fmtMs(totalDuration)}`,
  );

  // --- JSON 덤프 ---
  if (dumpJson) {
    const outPath = path.resolve(__dirname, '..', `test-pipeline-result-${Date.now()}.json`);
    const dump = results.map((r) => ({
      name: r.name,
      error: r.error,
      stage0: {
        directives: r.stage0.directives,
        durationMs: r.stage0.durationMs,
        tokens: r.stage0.tokens,
        stopReason: r.stage0.stopReason,
      },
      grounding: {
        status: r.grounding.status,
        durationMs: r.grounding.durationMs,
        searchQueries: r.grounding.searchQueries,
        sourcesCount: r.grounding.sources.length,
        researchTextLength: r.grounding.researchText.length,
        errorMessage: r.grounding.errorMessage,
      },
      stage1: {
        interviewSetup: r.stage1.interviewSetup,
        zodError: r.stage1.zodError,
        durationMs: r.stage1.durationMs,
        tokens: r.stage1.tokens,
        stopReason: r.stage1.stopReason,
      },
      stage2: r.stage2 ? {
        promptLength: r.stage2.promptLength,
      } : null,
      checks: {
        stage0: r.checks.stage0.map((c) => ({ pass: c.pass, label: c.label, detail: c.detail })),
        stage1: r.checks.stage1.map((c) => ({ pass: c.pass, label: c.label, detail: c.detail })),
        gapMapping: r.checks.gapMapping.map((c) => ({ pass: c.pass, label: c.label, detail: c.detail })),
        stage2: r.checks.stage2.map((c) => ({ pass: c.pass, label: c.label, detail: c.detail })),
      },
    }));

    fs.writeFileSync(outPath, JSON.stringify(dump, null, 2), 'utf-8');
    console.log(`\n  ${C.green('✓')} JSON 덤프: ${outPath}`);
  }

  // 종료 코드
  process.exit(totalFail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(C.red('\n치명적 오류:'), err);
  process.exit(2);
});
