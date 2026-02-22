import { NextRequest, NextResponse } from 'next/server';
import { getGeminiClient } from '@/lib/gemini';
import { GEMINI_MODEL } from '@/lib/constants';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
];

const OCR_PROMPT = `이 이미지에서 텍스트를 정확하게 추출해주세요.

규칙:
- 이미지에 보이는 모든 텍스트를 빠짐없이 추출
- 원본의 구조(제목, 목록, 단락 등)를 최대한 유지
- 표가 있으면 텍스트로 변환
- 이미지 설명이나 부가 해석은 하지 말고 텍스트만 추출
- 채용공고/이력서 형식이면 섹션 구분을 유지 (예: [자격요건], [우대사항] 등)`;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('image') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: '이미지 파일이 필요합니다.' },
        { status: 400 }
      );
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'PNG, JPG, WebP, GIF 이미지만 지원합니다.' },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: '이미지 크기는 10MB 이하만 가능합니다.' },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString('base64');

    const gemini = getGeminiClient();

    const response = await gemini.models.generateContent({
      model: GEMINI_MODEL,
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType: file.type,
                data: base64,
              },
            },
            { text: OCR_PROMPT },
          ],
        },
      ],
    });

    const text = response.text?.trim();

    if (!text) {
      return NextResponse.json(
        { error: '이미지에서 텍스트를 추출하지 못했습니다.' },
        { status: 422 }
      );
    }

    return NextResponse.json({ text });
  } catch (error) {
    console.error('OCR 실패:', error);
    return NextResponse.json(
      { error: '이미지 텍스트 추출에 실패했습니다. 다시 시도해주세요.' },
      { status: 500 }
    );
  }
}
