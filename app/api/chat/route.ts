import { NextRequest, NextResponse } from 'next/server';
import { buildInterviewerPrompt } from '@/lib/prompts';
import { getGeminiClient } from '@/lib/gemini';
import type { InterviewSetupJSON } from '@/lib/schemas/interviewSetup';
import { GEMINI_MODEL, INTERVIEW_END_TOKEN } from '@/lib/constants';

/**
 * 면접 진행에 필요한 필드만 추출하여 토큰 사용량을 줄인다.
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

function stripEndToken(text: string): string {
  return text.replaceAll(INTERVIEW_END_TOKEN, '').trim();
}

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export async function POST(req: NextRequest) {
  try {
    const { interviewSetup, history, userMessage } = await req.json() as {
      interviewSetup: InterviewSetupJSON;
      history: ChatMessage[];
      userMessage?: string;
    };

    if (!interviewSetup) {
      return NextResponse.json(
        { error: '면접 설정 데이터가 필요합니다.' },
        { status: 400 }
      );
    }

    const filtered = filterForInterview(interviewSetup);
    const systemPrompt = buildInterviewerPrompt(JSON.stringify(filtered));

    // 대화 이력을 Gemini contents 형식으로 변환
    const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

    if (history && history.length > 0) {
      for (const msg of history) {
        contents.push({
          role: msg.role,
          parts: [{ text: msg.text }],
        });
      }
    }

    // 사용자 입력에서 시스템 토큰 제거 (인젝션 방지)
    if (userMessage) {
      const sanitized = stripEndToken(userMessage);
      contents.push({
        role: 'user',
        parts: [{ text: sanitized }],
      });
    } else if (contents.length === 0) {
      // 면접 시작 — 첫 호출
      contents.push({
        role: 'user',
        parts: [{ text: '면접을 시작해주세요. 간단히 인사하고 바로 첫 번째 질문으로 넘어가주세요.' }],
      });
    }

    const start = Date.now();

    const client = getGeminiClient();
    const response = await client.models.generateContent({
      model: GEMINI_MODEL,
      contents,
      config: {
        systemInstruction: systemPrompt,
        maxOutputTokens: 1024,
        temperature: 0.8,
      },
    });

    const durationMs = Date.now() - start;
    let reply = response.text ?? '';

    // [INTERVIEW_END] 감지
    const isInterviewEnd = reply.includes(INTERVIEW_END_TOKEN);

    // 표시용 텍스트에서 토큰 제거
    reply = stripEndToken(reply);

    const usage = response.usageMetadata;

    return NextResponse.json({
      reply,
      isInterviewEnd,
      _chatMetrics: {
        durationMs,
        promptTokenCount: usage?.promptTokenCount ?? 0,
        candidatesTokenCount: usage?.candidatesTokenCount ?? 0,
        model: GEMINI_MODEL,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('채팅 면접 실패:', errMsg);
    return NextResponse.json(
      { error: '면접 응답 생성에 실패했습니다. 다시 시도해주세요.', detail: errMsg },
      { status: 500 }
    );
  }
}
