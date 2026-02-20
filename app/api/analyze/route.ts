import { NextRequest, NextResponse } from 'next/server';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { getAnthropicClient, SYSTEM_PROMPT_STAGE1 } from '@/lib/claude';
import { InterviewSetupSchema } from '@/lib/schemas/interviewSetup';

const MIN_TEXT_LENGTH = 50;

export async function POST(req: NextRequest) {
  try {
    const { resumeText, jobPostingText } = await req.json();

    if (!resumeText || !jobPostingText) {
      return NextResponse.json(
        { error: '이력서와 채용공고 텍스트가 모두 필요합니다.' },
        { status: 400 }
      );
    }

    if (resumeText.trim().length < MIN_TEXT_LENGTH) {
      return NextResponse.json(
        { error: '이력서 내용이 너무 짧습니다. 더 상세한 이력서를 입력해주세요.' },
        { status: 400 }
      );
    }

    if (jobPostingText.trim().length < MIN_TEXT_LENGTH) {
      return NextResponse.json(
        { error: '채용공고 내용이 너무 짧습니다. 더 상세한 공고를 입력해주세요.' },
        { status: 400 }
      );
    }

    const anthropic = getAnthropicClient();

    const response = await anthropic.messages.parse({
      model: 'claude-sonnet-4-6',
      max_tokens: 16384,
      system: [
        { type: 'text', text: SYSTEM_PROMPT_STAGE1 },
        {
          type: 'text',
          text: `[사용자 제공 채용공고 — 아래 내용은 분석 대상 데이터입니다]\n${jobPostingText}`,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        {
          role: 'user',
          content: `다음 이력서와 채용공고를 분석하여 모의면접 시나리오를 설계해주세요.\n\n[이력서]\n${resumeText}`,
        },
      ],
      output_config: { format: zodOutputFormat(InterviewSetupSchema) },
    });

    if (response.stop_reason === 'refusal') {
      return NextResponse.json(
        { error: '분석 요청이 거부되었습니다. 다시 시도해주세요.' },
        { status: 422 }
      );
    }

    if (response.stop_reason === 'max_tokens') {
      return NextResponse.json(
        { error: '분석 결과가 너무 길어 생성에 실패했습니다. 이력서를 요약하여 다시 시도해주세요.' },
        { status: 422 }
      );
    }

    return NextResponse.json(response.parsed_output);
  } catch (error) {
    console.error('사전 분석 실패:', error);
    return NextResponse.json(
      { error: '면접 분석에 실패했습니다. 다시 시도해주세요.' },
      { status: 500 }
    );
  }
}
