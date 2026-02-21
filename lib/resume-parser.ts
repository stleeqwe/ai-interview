import { fileTypeFromBuffer } from 'file-type';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const ALLOWED_MIMES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.md', '.txt'];

export interface ParseResult {
  text: string;
  fileName: string;
}

// 파일 확장자 추출
function getExtension(fileName: string): string {
  const idx = fileName.lastIndexOf('.');
  return idx >= 0 ? fileName.slice(idx).toLowerCase() : '';
}

// 파일 검증
export function validateResumeFile(file: File): string | null {
  if (file.size > MAX_FILE_SIZE) {
    return '파일 크기는 5MB 이하여야 합니다.';
  }

  const ext = getExtension(file.name);
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return '지원하지 않는 파일 형식입니다. PDF, DOCX, MD, TXT 파일만 업로드 가능합니다.';
  }

  return null;
}

// 이력서 파싱 (서버 사이드)
export async function parseResume(buffer: Buffer, fileName: string): Promise<string> {
  const ext = getExtension(fileName);

  // 매직 바이트로 실제 파일 타입 검증
  const detectedType = await fileTypeFromBuffer(buffer);

  if (ext === '.pdf') {
    if (detectedType && detectedType.mime !== 'application/pdf') {
      throw new Error('파일 내용이 PDF 형식이 아닙니다.');
    }
    const { extractText, getDocumentProxy } = await import('unpdf');
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const result = await extractText(pdf, { mergePages: true });
    return result.text;
  }

  if (ext === '.docx') {
    if (
      detectedType &&
      !ALLOWED_MIMES.has(detectedType.mime)
    ) {
      throw new Error('파일 내용이 Word 문서 형식이 아닙니다.');
    }
    const mammoth = await import('mammoth');
    const result = await mammoth.default.extractRawText({ buffer });
    return result.value;
  }

  // .md, .txt — 텍스트 파일
  return buffer.toString('utf-8');
}
