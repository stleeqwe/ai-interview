/** Claude Stage 0이 생성하는 개별 조사 지시문 */
export interface ResearchDirective {
  id: string;
  priority: 1 | 2 | 3;
  category: 'company_intelligence' | 'domain_knowledge' | 'technology_deep_dive' | 'role_benchmarking';
  query: string;
  context: string;
  fallback_strategy: string;
}

/** Claude Stage 0의 전체 출력 — Gemini 그라운딩에 전달되는 조사 계획 */
export interface ResearchDirectiveSet {
  candidate_summary: string;
  position_summary: string;
  identified_gaps: string[];
  directives: ResearchDirective[];
}

/** Google Search Grounding 리서치 결과의 개별 웹 소스 */
export interface GroundingSource {
  title: string;
  uri: string;
  domain: string;
}

/** Grounding 지원 정보 — 리서치 텍스트의 어떤 부분이 어떤 소스에 근거하는지 */
export interface GroundingEvidence {
  text: string;
  sourceIndices: number[];
}

/** performGroundingResearch()의 구조화된 반환값 */
export interface GroundingReport {
  status: 'success' | 'skipped' | 'error';

  /** Gemini가 실행한 검색 쿼리 목록 */
  searchQueries: string[];

  /** 검색에서 수집된 웹 소스 목록 */
  sources: GroundingSource[];

  /** 소스 근거 매핑 (리서치 텍스트 → 소스) */
  evidences: GroundingEvidence[];

  /** Gemini가 생성한 리서치 리포트 전문 */
  researchText: string;

  /** 소요 시간 (ms) */
  durationMs: number;

  /** 에러 발생 시 메시지 */
  errorMessage?: string;

  /** 타임스탬프 */
  timestamp: string;
}
