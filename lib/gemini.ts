import { GoogleGenAI } from '@google/genai';
import type {
  GroundingReport,
  GroundingSource,
  GroundingEvidence,
  ResearchDirectiveSet,
} from '@/lib/types/grounding';
import { GEMINI_MODEL } from '@/lib/constants';

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

const DIRECTED_GROUNDING_PROMPT = `당신은 면접 준비를 위한 리서치 어시스턴트입니다.
주어진 조사 지시문(directives)에 따라 Google 검색을 수행하고 결과를 정리하세요.

## 리서치 규칙

1. priority 1 항목을 먼저 조사하세요. 시간이 부족하면 priority 3은 건너뛰세요.
2. 각 directive의 query를 기반으로 검색하되, 더 효과적인 검색어가 있다면 변형해도 됩니다.
3. 각 directive에 대해 다음 형식으로 결과를 정리하세요:

### [directive id] (priority N)
**핵심 발견**: (핵심 발견사항 3~5줄)
**면접 활용**: (이 정보를 면접 질문에 어떻게 활용할 수 있는지 1~2줄)

4. 검색 결과가 없거나 부족한 directive는 다음과 같이 표시하세요:
### [directive id] — 정보 부족
**대안**: (fallback_strategy 기반 대안 정보)

5. 한국어로 작성하세요. 사실만 보고하세요. 추측이나 의견을 넣지 마세요.
6. 전체 리포트를 2000자 이내로 유지하세요.`;

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

/**
 * Gemini generateContent를 래핑하여 JSON 텍스트를 반환하는 범용 헬퍼.
 * 마크다운 코드 펜스(```json)를 자동 제거하고, 토큰 사용량을 함께 반환한다.
 */
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
}> {
  const client = getGeminiClient();
  const response = await client.models.generateContent({
    model: GEMINI_MODEL,
    contents: params.userMessage,
    config: {
      systemInstruction: params.systemPrompt,
      maxOutputTokens: params.maxOutputTokens,
      temperature: params.temperature,
    },
  });

  let text = (response.text ?? '').trim(); // BUG 7 fix: trim before fence check
  // 마크다운 코드 펜스 자동 제거
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '').trim();
  }

  const usage = response.usageMetadata;
  const finishReason = response.candidates?.[0]?.finishReason ?? 'UNKNOWN';

  return {
    text,
    promptTokenCount: usage?.promptTokenCount ?? 0,
    candidatesTokenCount: usage?.candidatesTokenCount ?? 0,
    finishReason,
  };
}

/**
 * Stage 0이 생성한 조사 지시문을 기반으로 Gemini 그라운딩 리서치를 수행한다.
 */
export async function performDirectedResearch(
  directives: ResearchDirectiveSet,
): Promise<GroundingReport> {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return makeSkippedReport('GOOGLE_API_KEY 미설정');
  }

  if (!directives.directives || directives.directives.length === 0) {
    return makeSkippedReport('조사 지시문이 비어있음');
  }

  const start = Date.now();

  // 조사 지시문을 Gemini에 전달할 텍스트로 변환
  const directiveLines = directives.directives
    .sort((a, b) => a.priority - b.priority)
    .map(
      (d) =>
        `- [${d.id}] (priority ${d.priority}, ${d.category})\n  검색: ${d.query}\n  목적: ${d.context}\n  대안: ${d.fallback_strategy}`,
    )
    .join('\n\n');

  const userContent = `[조사 지시문]
${directiveLines}

[참고: 지원자 프로필]
${directives.candidate_summary}

[참고: 지원 포지션]
${directives.position_summary}

[참고: 식별된 갭]
${directives.identified_gaps.map((g) => `- ${g}`).join('\n')}`;

  try {
    const client = getGeminiClient();
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), 120_000);

    try {
      const response = await client.models.generateContent({
        model: GEMINI_MODEL,
        contents: userContent,
        config: {
          systemInstruction: DIRECTED_GROUNDING_PROMPT,
          tools: [{ googleSearch: {} }],
          temperature: 1.0,
          abortSignal: abortController.signal,
        },
      });

      const durationMs = Date.now() - start;
      const researchText = response.text ?? '';

      const metadata = response.candidates?.[0]?.groundingMetadata;

      const searchQueries: string[] = metadata?.webSearchQueries ?? [];

      const sources: GroundingSource[] = (metadata?.groundingChunks ?? [])
        .filter((chunk) => chunk.web)
        .map((chunk) => ({
          title: chunk.web!.title ?? '(제목 없음)',
          uri: chunk.web!.uri ?? '',
          domain:
            chunk.web!.domain ??
            new URL(chunk.web!.uri ?? 'https://unknown').hostname,
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
    console.warn('Gemini 지시문 기반 리서치 실패 (면접 생성은 정상 진행):', error);

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
