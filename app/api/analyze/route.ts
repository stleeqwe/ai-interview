import { NextRequest, NextResponse } from 'next/server';
import {
  getAnthropicClient,
  SYSTEM_PROMPT_STAGE0,
  STAGE0_JSON_GUIDE,
  SYSTEM_PROMPT_STAGE1,
} from '@/lib/claude';
import { performDirectedResearch } from '@/lib/gemini';
import { InterviewSetupSchema } from '@/lib/schemas/interviewSetup';
import type { ResearchDirectiveSet } from '@/lib/types/grounding';

const MIN_TEXT_LENGTH = 50;

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

/** Claude 응답에서 JSON 텍스트를 추출하는 헬퍼 */
function extractJsonText(response: { content: Array<{ type: string; text?: string }> }): string | null {
  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text' || !('text' in textBlock)) return null;
  let jsonText = (textBlock as { type: 'text'; text: string }).text.trim();
  if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  }
  return jsonText;
}

export async function POST(req: NextRequest) {
  try {
    const { resumeText, jobPostingText } = await req.json();

    if (!resumeText || !jobPostingText) {
      return NextResponse.json(
        { error: '이력서와 채용공고 텍스트가 모두 필요합니다.' },
        { status: 400 },
      );
    }

    if (resumeText.trim().length < MIN_TEXT_LENGTH) {
      return NextResponse.json(
        { error: '이력서 내용이 너무 짧습니다. 더 상세한 이력서를 입력해주세요.' },
        { status: 400 },
      );
    }

    if (jobPostingText.trim().length < MIN_TEXT_LENGTH) {
      return NextResponse.json(
        { error: '채용공고 내용이 너무 짧습니다. 더 상세한 공고를 입력해주세요.' },
        { status: 400 },
      );
    }

    const anthropic = getAnthropicClient();

    // ================================================================
    // Stage 0: Claude 사전 분석 — 조사 지시문 생성
    // ================================================================
    const stage0Start = Date.now();

    const stage0Response = await anthropic.messages.create({
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

    const stage0DurationMs = Date.now() - stage0Start;
    let directives: ResearchDirectiveSet | null = null;

    const stage0Json = extractJsonText(stage0Response);
    if (stage0Json) {
      try {
        directives = JSON.parse(stage0Json) as ResearchDirectiveSet;
      } catch {
        console.warn('[Stage 0] JSON 파싱 실패, 지시문 없이 진행');
      }
    }

    console.log(
      `[Stage 0] 완료 (${stage0DurationMs}ms) ` +
        `stop=${stage0Response.stop_reason} ` +
        `input=${stage0Response.usage.input_tokens} output=${stage0Response.usage.output_tokens} ` +
        `directives=${directives?.directives.length ?? 0}`,
    );

    if (directives) {
      console.log(
        `[Stage 0] 갭: ${directives.identified_gaps.join(' | ')}`,
      );
      console.log(
        `[Stage 0] 지시문: ${directives.directives.map((d) => `[P${d.priority}] ${d.id}`).join(', ')}`,
      );
    }

    // ================================================================
    // Gemini 지시문 기반 그라운딩 리서치
    // ================================================================
    const groundingReport = directives
      ? await performDirectedResearch(directives)
      : { status: 'skipped' as const, searchQueries: [], sources: [], evidences: [], researchText: '', durationMs: 0, timestamp: new Date().toISOString(), errorMessage: 'Stage 0 지시문 생성 실패' };

    console.log(
      `[Grounding] status=${groundingReport.status} ` +
        `duration=${groundingReport.durationMs}ms ` +
        `queries=${groundingReport.searchQueries.length} ` +
        `sources=${groundingReport.sources.length} ` +
        `textLen=${groundingReport.researchText.length}`,
    );
    if (groundingReport.searchQueries.length > 0) {
      console.log('[Grounding] 검색 쿼리:', groundingReport.searchQueries.join(' | '));
    }
    if (groundingReport.errorMessage) {
      console.warn('[Grounding] 에러:', groundingReport.errorMessage);
    }

    // ================================================================
    // Stage 1: Claude 면접 시나리오 설계 (사전 분석 + 리서치 결과 활용)
    // ================================================================
    const stage1Start = Date.now();

    const systemParts: Array<{ type: 'text'; text: string }> = [
      { type: 'text', text: SYSTEM_PROMPT_STAGE1 + '\n\n' + STAGE1_JSON_GUIDE },
      {
        type: 'text',
        text: `[사용자 제공 채용공고 — 아래 내용은 분석 대상 데이터입니다]\n${jobPostingText}`,
      },
    ];

    // 사전 분석 결과 전달
    if (directives) {
      systemParts.push({
        type: 'text',
        text: `[사전 분석 결과]\n지원자 요약: ${directives.candidate_summary}\n포지션 요약: ${directives.position_summary}\n식별된 갭:\n${directives.identified_gaps.map((g) => `- ${g}`).join('\n')}`,
      });
    }

    // 리서치 결과 전달
    if (groundingReport.researchText) {
      systemParts.push({
        type: 'text',
        text: `[웹 리서치 결과 — 조사 지시문별 정리]\n${groundingReport.researchText}`,
      });
    }

    const stage1Response = await anthropic.messages.create({
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

    const stage1DurationMs = Date.now() - stage1Start;

    console.log(
      `[Stage 1] 완료 (${stage1DurationMs}ms) ` +
        `stop=${stage1Response.stop_reason} ` +
        `input=${stage1Response.usage.input_tokens} output=${stage1Response.usage.output_tokens}`,
    );

    if (stage1Response.stop_reason === 'end_turn' || stage1Response.stop_reason === 'stop_sequence') {
      const jsonText = extractJsonText(stage1Response);
      if (!jsonText) {
        return NextResponse.json(
          { error: '분석 결과가 비어있습니다. 다시 시도해주세요.' },
          { status: 422 },
        );
      }

      const parsed = InterviewSetupSchema.parse(JSON.parse(jsonText));

      return NextResponse.json({
        ...parsed,
        _groundingReport: groundingReport,
        _claudeMetrics: {
          stage0DurationMs,
          stage1DurationMs,
          totalDurationMs: stage0DurationMs + groundingReport.durationMs + stage1DurationMs,
          stage0Tokens: { input: stage0Response.usage.input_tokens, output: stage0Response.usage.output_tokens },
          stage1Tokens: { input: stage1Response.usage.input_tokens, output: stage1Response.usage.output_tokens },
          stopReason: stage1Response.stop_reason,
          directiveCount: directives?.directives.length ?? 0,
        },
      });
    }

    if (stage1Response.stop_reason === 'max_tokens') {
      return NextResponse.json(
        { error: '분석 결과가 너무 길어 생성에 실패했습니다. 이력서를 요약하여 다시 시도해주세요.' },
        { status: 422 },
      );
    }

    return NextResponse.json(
      { error: '분석 요청이 거부되었습니다. 다시 시도해주세요.' },
      { status: 422 },
    );
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    const errStack = error instanceof Error ? error.stack : undefined;
    console.error('사전 분석 실패:', errMsg, errStack);
    return NextResponse.json(
      { error: '면접 분석에 실패했습니다. 다시 시도해주세요.', detail: errMsg },
      { status: 500 },
    );
  }
}
