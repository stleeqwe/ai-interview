import { NextRequest, NextResponse } from 'next/server';
import { buildInterviewerPrompt } from '@/lib/claude';
import type { InterviewSetupJSON } from '@/lib/schemas/interviewSetup';

/**
 * 면접 진행에 필요한 필드만 추출하여 토큰 사용량을 줄인다.
 * gap_analysis, experience_depth_estimate, evaluation_criteria, expected_answer_direction은
 * 분석/평가 단계에서만 사용되므로 면접 진행 프롬프트에서 제외한다.
 */
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

export async function POST(req: NextRequest) {
  try {
    const { interviewSetup } = await req.json();

    if (!interviewSetup) {
      return NextResponse.json(
        { error: '면접 설정 데이터가 필요합니다.' },
        { status: 400 }
      );
    }

    const filtered = filterForInterview(interviewSetup);
    const systemPrompt = buildInterviewerPrompt(JSON.stringify(filtered));

    // OpenAI Realtime API: ephemeral client secret 발급
    const response = await fetch(
      'https://api.openai.com/v1/realtime/client_secrets',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          expires_after: { anchor: 'created_at', seconds: 3600 },
          session: {
            type: 'realtime',
            model: 'gpt-realtime',
            instructions: systemPrompt,
            max_output_tokens: 4096,
            audio: {
              input: {
                transcription: { model: 'gpt-4o-transcribe' },
                turn_detection: {
                  type: 'server_vad',
                  threshold: 0.5,
                  silence_duration_ms: 2000,
                },
              },
              output: {
                voice: 'coral',
              },
            },
          },
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      console.error('OpenAI session 생성 실패:', response.status, errorData);
      return NextResponse.json(
        { error: '면접 세션 생성에 실패했습니다.' },
        { status: 502 }
      );
    }

    const data = await response.json();

    return NextResponse.json({
      clientSecret: data.value,
      expiresAt: data.expires_at,
    });
  } catch (error) {
    console.error('세션 생성 실패:', error);
    return NextResponse.json(
      { error: '세션 생성에 실패했습니다. 다시 시도해주세요.' },
      { status: 500 }
    );
  }
}
