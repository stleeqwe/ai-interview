import { NextRequest, NextResponse } from 'next/server';
import { extractWantedJobId, fetchWantedJob } from '@/lib/wanted';

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { error: '원티드 URL을 입력해주세요.' },
        { status: 400 }
      );
    }

    const jobId = extractWantedJobId(url);
    if (!jobId) {
      return NextResponse.json(
        { error: '유효한 원티드 URL이 아닙니다. (예: https://www.wanted.co.kr/wd/12345)' },
        { status: 400 }
      );
    }

    const result = await fetchWantedJob(jobId);

    return NextResponse.json({
      text: result.text,
      companyName: result.companyName,
      position: result.position,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : '채용공고를 가져오는데 실패했습니다.';
    console.error('채용공고 크롤링 실패:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
