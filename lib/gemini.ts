import { GoogleGenAI } from '@google/genai';
import type { GroundingReport, GroundingSource, GroundingEvidence } from '@/lib/types/grounding';

const globalForGemini = globalThis as unknown as { geminiClient?: GoogleGenAI };

export function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_API_KEY 환경변수가 설정되지 않았습니다.');
  }
  if (!globalForGemini.geminiClient) {
    globalForGemini.geminiClient = new GoogleGenAI({ apiKey });
  }
  return globalForGemini.geminiClient;
}

const GROUNDING_SYSTEM_PROMPT = `당신은 면접 준비를 위한 리서치 어시스턴트입니다.
아래 이력서와 채용공고를 분석하고, Google 검색을 활용하여 다음 정보를 조사하세요:

1. 해당 회사의 기술 블로그, 엔지니어링 문화, 최근 기술적 움직임
2. 포지션에서 요구하는 기술 스택의 최신 트렌드와 실무 이슈
3. 도메인 특화 지식 (핀테크→결제/규제, 헬스케어→규제/인증, 이커머스→트래픽/결제 등)
4. 해당 직급에서 기대되는 역량 수준과 면접에서 자주 나오는 주제

조사 결과를 한국어로 정리하여 면접 질문 설계에 활용할 수 있는 리서치 리포트를 작성하세요.
각 항목별로 핵심 포인트만 간결하게 정리하세요.`;

function makeSkippedReport(reason: string): GroundingReport {
  return {
    status: 'skipped',
    searchQueries: [],
    sources: [],
    evidences: [],
    researchText: '',
    durationMs: 0,
    errorMessage: reason,
    timestamp: new Date().toISOString(),
  };
}

export async function performGroundingResearch(
  resumeText: string,
  jobPostingText: string,
): Promise<GroundingReport> {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return makeSkippedReport('GOOGLE_API_KEY 미설정');
  }

  const start = Date.now();

  try {
    const client = getGeminiClient();
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), 15_000);

    try {
      const response = await client.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `[채용공고]\n${jobPostingText}\n\n[이력서]\n${resumeText}`,
        config: {
          systemInstruction: GROUNDING_SYSTEM_PROMPT,
          tools: [{ googleSearch: {} }],
          abortSignal: abortController.signal,
        },
      });

      const durationMs = Date.now() - start;
      const researchText = response.text ?? '';

      // --- 메타데이터 추출 ---
      const metadata = response.candidates?.[0]?.groundingMetadata;

      const searchQueries: string[] = metadata?.webSearchQueries ?? [];

      const sources: GroundingSource[] = (metadata?.groundingChunks ?? [])
        .filter((chunk) => chunk.web)
        .map((chunk) => ({
          title: chunk.web!.title ?? '(제목 없음)',
          uri: chunk.web!.uri ?? '',
          domain: chunk.web!.domain ?? new URL(chunk.web!.uri ?? 'https://unknown').hostname,
        }));

      const evidences: GroundingEvidence[] = (metadata?.groundingSupports ?? [])
        .filter((s) => s.segment?.text)
        .map((s) => ({
          text: s.segment!.text!,
          sourceIndices: s.groundingChunkIndices ?? [],
        }));

      return {
        status: 'success',
        searchQueries,
        sources,
        evidences,
        researchText,
        durationMs,
        timestamp: new Date().toISOString(),
      };
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    const durationMs = Date.now() - start;
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn('Google Search 리서치 실패 (면접 생성은 정상 진행):', error);

    return {
      status: 'error',
      searchQueries: [],
      sources: [],
      evidences: [],
      researchText: '',
      durationMs,
      errorMessage,
      timestamp: new Date().toISOString(),
    };
  }
}
