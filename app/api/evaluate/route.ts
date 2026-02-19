import { NextRequest, NextResponse } from 'next/server';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { getAnthropicClient, SYSTEM_PROMPT_STAGE3 } from '@/lib/claude';
import { EvaluationSchema } from '@/lib/schemas/evaluation';

export async function POST(req: NextRequest) {
  try {
    const { interviewSetup, transcript } = await req.json();

    if (!interviewSetup || !transcript) {
      return NextResponse.json(
        { error: '면접 설정과 대화 기록이 모두 필요합니다.' },
        { status: 400 }
      );
    }

    const anthropic = getAnthropicClient();

    const response = await anthropic.messages.parse({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      system: [
        { type: 'text', text: SYSTEM_PROMPT_STAGE3 },
        {
          type: 'text',
          text: `[면접 설정]\n${JSON.stringify(interviewSetup, null, 2)}`,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        {
          role: 'user',
          content: `다음 면접 대화 기록을 분석하여 평가 리포트를 생성해주세요.\n\n[면접 대화 기록]\n${transcript}`,
        },
      ],
      output_config: { format: zodOutputFormat(EvaluationSchema) },
    });

    if (response.stop_reason === 'refusal') {
      return NextResponse.json(
        { error: '평가 요청이 거부되었습니다.' },
        { status: 422 }
      );
    }

    return NextResponse.json(response.parsed_output);
  } catch (error) {
    console.error('사후 평가 실패:', error);
    return NextResponse.json(
      { error: '평가 리포트 생성에 실패했습니다. 다시 시도해주세요.' },
      { status: 500 }
    );
  }
}
