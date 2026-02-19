import { NextRequest, NextResponse } from 'next/server';
import { buildInterviewerPrompt } from '@/lib/claude';

export async function POST(req: NextRequest) {
  try {
    const { interviewSetup } = await req.json();

    if (!interviewSetup) {
      return NextResponse.json(
        { error: '면접 설정 데이터가 필요합니다.' },
        { status: 400 }
      );
    }

    const systemPrompt = buildInterviewerPrompt(
      JSON.stringify(interviewSetup, null, 2)
    );

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
            model: 'gpt-4o-realtime-preview',
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
