import { NextRequest, NextResponse } from 'next/server';
import { SYSTEM_PROMPT_STAGE3 } from '@/lib/prompts';
import { geminiGenerateJSON } from '@/lib/gemini';
import { EvaluationSchema } from '@/lib/schemas/evaluation';

const JSON_STRUCTURE_GUIDE = `
## 출력 JSON 구조

반드시 아래 구조와 정확히 일치하는 JSON을 출력하세요. 추가 필드를 넣지 마세요.
유효한 JSON만 출력하세요. 마크다운 코드블록으로 감싸지 마세요.

{
  "overall_evaluation": {
    "overall_grade": "A" | "B" | "C" | "D",
    "summary": "string (3~5문장)",
    "hire_recommendation": "강력 추천" | "추천" | "보류" | "비추천",
    "key_strengths": ["string", ...],
    "key_improvements": ["string", ...],
    "strengths_feedback": ["string", ...],
    "seniority_fit": {
      "claimed_level": "string",
      "assessed_level": "string",
      "evidence": "string"
    },
    "job_readiness": {
      "readiness_level": "즉시 투입 가능" | "단기 적응 필요" | "장기 준비 필요",
      "reason": "string"
    },
    "consistency_assessment": {
      "answer_consistency": "구체적이고 일관됨" | "추가 설명 필요" | "경험 깊이 불확실",
      "details": "string"
    }
  },
  "question_evaluations": [
    {
      "question_id": number,
      "question_text": "string",
      "candidate_answer_summary": "string",
      "grade": "A" | "B" | "C" | "D",
      "scores": {
        "technical_accuracy": { "score": "상" | "중" | "하", "comment": "string" },
        "logical_structure": { "score": "상" | "중" | "하", "comment": "string" },
        "specificity": { "score": "상" | "중" | "하", "comment": "string" }
      },
      "feedback": "string",
      "model_answer": "string",
      "answer_structure_feedback": "string | null (선택)",
      "follow_up_performance": "string | null (선택)",
      "red_flag": "string | null (선택)"
    }
  ],
  "skill_radar": {
    "technical_knowledge": "상" | "중" | "하",
    "problem_solving": "상" | "중" | "하",
    "communication": "상" | "중" | "하",
    "experience_depth": "상" | "중" | "하",
    "culture_fit": "상" | "중" | "하"
  },
  "action_items": [
    {
      "priority": "높음" | "중간",
      "area": "string",
      "action": "string",
      "example": "string"
    }
  ],
  "next_preparation_guide": "string"
}`;

export async function POST(req: NextRequest) {
  try {
    const { interviewSetup, transcript, resumeText } = await req.json();

    if (!interviewSetup || !transcript) {
      return NextResponse.json(
        { error: '면접 설정과 대화 기록이 모두 필요합니다.' },
        { status: 400 }
      );
    }

    const systemParts: string[] = [SYSTEM_PROMPT_STAGE3, JSON_STRUCTURE_GUIDE];

    if (resumeText) {
      systemParts.push(`[원본 이력서]\n${resumeText}`);
    }

    systemParts.push(`[면접 설정]\n${JSON.stringify(interviewSetup, null, 2)}`);

    const evalStart = Date.now();
    const evalStartISO = new Date(evalStart).toISOString();
    const evalSystemPrompt = systemParts.join('\n\n');
    const evalUserMessage = `다음 면접 대화 기록을 분석하여 평가 리포트를 JSON으로 생성해주세요.\n\n반드시 유효한 JSON만 출력하세요. 마크다운 코드블록(\`\`\`json)으로 감싸지 마세요.\n\n[면접 대화 기록]\n${transcript}`;

    const response = await geminiGenerateJSON({
      systemPrompt: evalSystemPrompt,
      userMessage: evalUserMessage,
      maxOutputTokens: 16384,
    });

    if (!response.text) {
      return NextResponse.json(
        { error: '평가 리포트 생성 결과가 비어있습니다. 다시 시도해주세요.' },
        { status: 422 }
      );
    }

    let parsed;
    try {
      parsed = EvaluationSchema.parse(JSON.parse(response.text));
    } catch (parseErr) {
      return NextResponse.json(
        {
          error: '평가 JSON 파싱에 실패했습니다.',
          _evaluationMetrics: { rawResponse: response.text, parseError: String(parseErr) },
        },
        { status: 422 }
      );
    }
    const evalEnd = Date.now();
    const evalDurationMs = evalEnd - evalStart;

    console.log(
      `[Stage 3] 완료 (${evalDurationMs}ms) input=${response.promptTokenCount} output=${response.candidatesTokenCount}`
    );

    return NextResponse.json({
      ...parsed,
      _evaluationMetrics: {
        durationMs: evalDurationMs,
        inputTokens: response.promptTokenCount,
        outputTokens: response.candidatesTokenCount,
        finishReason: response.finishReason,
        model: 'gemini-3-flash-preview',
        timestamp: new Date().toISOString(),
        // 모니터링 확장 필드
        systemPrompt: evalSystemPrompt,
        userMessage: evalUserMessage,
        rawResponse: response.text,
        startedAt: evalStartISO,
        endedAt: new Date(evalEnd).toISOString(),
      },
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    const errStack = error instanceof Error ? error.stack : undefined;
    console.error('사후 평가 실패:', errMsg, errStack);
    return NextResponse.json(
      { error: '평가 리포트 생성에 실패했습니다. 다시 시도해주세요.', detail: errMsg },
      { status: 500 }
    );
  }
}
