import { NextRequest, NextResponse } from 'next/server';
import { parseResume, validateResumeFile } from '@/lib/resume-parser';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('resume') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: '이력서 파일이 필요합니다.' },
        { status: 400 }
      );
    }

    const validationError = validateResumeFile(file);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const text = await parseResume(buffer, file.name);

    if (!text.trim()) {
      return NextResponse.json(
        { error: '이력서에서 텍스트를 추출할 수 없습니다. 다른 파일을 시도해주세요.' },
        { status: 422 }
      );
    }

    return NextResponse.json({ text, fileName: file.name });
  } catch (error) {
    console.error('이력서 파싱 실패:', error);
    return NextResponse.json(
      { error: '이력서 파싱에 실패했습니다. 다시 시도해주세요.' },
      { status: 500 }
    );
  }
}
