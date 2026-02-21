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
