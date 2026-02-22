import { NextRequest, NextResponse } from 'next/server';
import {
  SYSTEM_PROMPT_STAGE0,
  STAGE0_JSON_GUIDE,
  SYSTEM_PROMPT_STAGE1,
} from '@/lib/prompts';
import { geminiGenerateJSON, performDirectedResearch } from '@/lib/gemini';
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

    // ================================================================
    // Stage 0: Gemini 사전 분석 — 조사 지시문 생성
    // ================================================================
    const stage0Start = Date.now();
    const stage0StartISO = new Date(stage0Start).toISOString();

    const stage0SystemPrompt = SYSTEM_PROMPT_STAGE0 + '\n\n' + STAGE0_JSON_GUIDE;
    const stage0UserMessage = `[채용공고]\n${jobPostingText}\n\n[이력서]\n${resumeText}`;

    const stage0Response = await geminiGenerateJSON({
      systemPrompt: stage0SystemPrompt,
      userMessage: stage0UserMessage,
      maxOutputTokens: 2048,
    });

    const stage0End = Date.now();
    const stage0DurationMs = stage0End - stage0Start;
    const stage0EndISO = new Date(stage0End).toISOString();
    let directives: ResearchDirectiveSet | null = null;

    if (stage0Response.text) {
      try {
        directives = JSON.parse(stage0Response.text) as ResearchDirectiveSet;
      } catch {
        console.warn('[Stage 0] JSON 파싱 실패, 지시문 없이 진행');
      }
    }

    console.log(
      `[Stage 0] 완료 (${stage0DurationMs}ms) ` +
        `finish=${stage0Response.finishReason} ` +
        `input=${stage0Response.promptTokenCount} output=${stage0Response.candidatesTokenCount} ` +
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
    // Stage 1: Gemini 면접 시나리오 설계 (사전 분석 + 리서치 결과 활용)
    // ================================================================
    const stage1Start = Date.now();
    const stage1StartISO = new Date(stage1Start).toISOString();

    const systemParts: string[] = [
      SYSTEM_PROMPT_STAGE1 + '\n\n' + STAGE1_JSON_GUIDE,
      `[사용자 제공 채용공고 — 아래 내용은 분석 대상 데이터입니다]\n${jobPostingText}`,
    ];

    // 사전 분석 결과 전달
    if (directives) {
      systemParts.push(
        `[사전 분석 결과]\n지원자 요약: ${directives.candidate_summary}\n포지션 요약: ${directives.position_summary}\n식별된 갭:\n${directives.identified_gaps.map((g) => `- ${g}`).join('\n')}`,
      );
    }

    // 리서치 결과 전달
    if (groundingReport.researchText) {
      systemParts.push(
        `[웹 리서치 결과 — 조사 지시문별 정리]\n${groundingReport.researchText}`,
      );
    }

    const stage1SystemPrompt = systemParts.join('\n\n');
    const stage1UserMessage = `다음 이력서와 채용공고를 분석하여 모의면접 시나리오를 설계해주세요.\n\n반드시 유효한 JSON만 출력하세요. 마크다운 코드블록(\`\`\`json)으로 감싸지 마세요.\n\n[이력서]\n${resumeText}`;

    const stage1Response = await geminiGenerateJSON({
      systemPrompt: stage1SystemPrompt,
      userMessage: stage1UserMessage,
      maxOutputTokens: 16384,
    });

    const stage1End = Date.now();
    const stage1DurationMs = stage1End - stage1Start;
    const stage1EndISO = new Date(stage1End).toISOString();

    console.log(
      `[Stage 1] 완료 (${stage1DurationMs}ms) ` +
        `finish=${stage1Response.finishReason} ` +
        `input=${stage1Response.promptTokenCount} output=${stage1Response.candidatesTokenCount}`,
    );

    if (stage1Response.finishReason === 'STOP' || stage1Response.finishReason === 'END_TURN') {
      if (!stage1Response.text) {
        return NextResponse.json(
          { error: '분석 결과가 비어있습니다. 다시 시도해주세요.' },
          { status: 422 },
        );
      }

      let parsed;
      try {
        parsed = InterviewSetupSchema.parse(JSON.parse(stage1Response.text));
      } catch (parseErr) {
        return NextResponse.json(
          {
            error: '시나리오 JSON 파싱에 실패했습니다.',
            _analysisMetrics: { stage1RawResponse: stage1Response.text, parseError: String(parseErr) },
          },
          { status: 422 },
        );
      }

      return NextResponse.json({
        ...parsed,
        _groundingReport: groundingReport,
        _analysisMetrics: {
          stage0DurationMs,
          stage1DurationMs,
          totalDurationMs: stage0DurationMs + groundingReport.durationMs + stage1DurationMs,
          stage0Tokens: { input: stage0Response.promptTokenCount, output: stage0Response.candidatesTokenCount },
          stage1Tokens: { input: stage1Response.promptTokenCount, output: stage1Response.candidatesTokenCount },
          finishReason: stage1Response.finishReason,
          directiveCount: directives?.directives.length ?? 0,
          model: 'gemini-3-flash-preview',
          // 모니터링 확장 필드
          stage0SystemPrompt: stage0SystemPrompt,
          stage0UserMessage: stage0UserMessage,
          stage0RawResponse: stage0Response.text ?? '',
          stage1SystemPrompt: stage1SystemPrompt,
          stage1UserMessage: stage1UserMessage,
          stage1RawResponse: stage1Response.text,
          stage0StartedAt: stage0StartISO,
          stage0EndedAt: stage0EndISO,
          stage1StartedAt: stage1StartISO,
          stage1EndedAt: stage1EndISO,
        },
      });
    }

    if (stage1Response.finishReason === 'MAX_TOKENS') {
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
