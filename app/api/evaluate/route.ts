import { NextRequest, NextResponse } from 'next/server';
import { getGeminiClient } from '@/lib/gemini';
import { SYSTEM_PROMPT_STAGE3 } from '@/lib/claude';
import { EvaluationSchema } from '@/lib/schemas/evaluation';

const JSON_STRUCTURE_GUIDE = `
## 출력 JSON 구조

반드시 아래 구조와 정확히 일치하는 JSON을 출력하세요. 추가 필드를 넣지 마세요.

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

    // 시스템 프롬프트 조합
    const systemParts = [SYSTEM_PROMPT_STAGE3, JSON_STRUCTURE_GUIDE];

    if (resumeText) {
      systemParts.push(`[원본 이력서]\n${resumeText}`);
    }

    systemParts.push(`[면접 설정]\n${JSON.stringify(interviewSetup, null, 2)}`);

    const gemini = getGeminiClient();

    const response = await gemini.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `다음 면접 대화 기록을 분석하여 평가 리포트를 JSON으로 생성해주세요.\n\n[면접 대화 기록]\n${transcript}`,
      config: {
        systemInstruction: systemParts.join('\n\n'),
        responseMimeType: 'application/json',
      },
    });

    const text = response.text;
    if (!text) {
      return NextResponse.json(
        { error: '평가 리포트 생성 결과가 비어있습니다. 다시 시도해주세요.' },
        { status: 422 }
      );
    }

    // Zod로 검증 및 파싱
    const parsed = EvaluationSchema.parse(JSON.parse(text));

    return NextResponse.json(parsed);
  } catch (error) {
    console.error('사후 평가 실패:', error);
    return NextResponse.json(
      { error: '평가 리포트 생성에 실패했습니다. 다시 시도해주세요.' },
      { status: 500 }
    );
  }
}
