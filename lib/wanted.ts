import pRetry, { AbortError } from 'p-retry';

// 원티드 URL에서 job_id 추출
export function extractWantedJobId(urlStr: string): number | null {
  try {
    const url = new URL(urlStr);
    if (!url.hostname.endsWith('wanted.co.kr')) return null;
    const match = url.pathname.match(/^\/wd\/(\d+)$/);
    return match ? parseInt(match[1], 10) : null;
  } catch {
    return null;
  }
}

// Wanted API v4 응답 타입
interface WantedJobDetail {
  position: string;
  company?: { name: string };
  detail?: {
    main_tasks?: string;
    requirements?: string;
    preferred_points?: string;
    benefits?: string;
    intro?: string;
  };
  skill_tags?: Array<{ title: string }>;
}

export interface ParsedWantedJob {
  companyName: string;
  position: string;
  text: string;
}

// Wanted API 호출 + 파싱
export async function fetchWantedJob(jobId: number): Promise<ParsedWantedJob> {
  const data = await pRetry(
    async () => {
      const res = await fetch(
        `https://www.wanted.co.kr/api/v4/jobs/${jobId}`,
        {
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(10_000),
        }
      );

      if (res.status === 404) {
        throw new AbortError('해당 채용공고를 찾을 수 없습니다.');
      }
      if (res.status === 429) {
        throw new Error('원티드 API 요청 제한');
      }
      if (!res.ok) {
        throw new Error(`원티드 API 오류: ${res.status}`);
      }

      return res.json();
    },
    { retries: 3, minTimeout: 1000, factor: 2 }
  );

  const job: WantedJobDetail = data.job ?? data;
  const companyName = job.company?.name ?? '';
  const position = job.position ?? '';

  const sections = [
    `[회사명] ${companyName}`,
    `[포지션] ${position}`,
    job.detail?.intro ? `[회사/팀 소개]\n${job.detail.intro}` : '',
    job.detail?.main_tasks ? `[주요업무]\n${job.detail.main_tasks}` : '',
    job.detail?.requirements ? `[자격요건]\n${job.detail.requirements}` : '',
    job.detail?.preferred_points
      ? `[우대사항]\n${job.detail.preferred_points}`
      : '',
    job.detail?.benefits ? `[혜택 및 복지]\n${job.detail.benefits}` : '',
    job.skill_tags?.length
      ? `[기술스택] ${job.skill_tags.map((t) => t.title).join(', ')}`
      : '',
  ].filter(Boolean);

  return {
    companyName,
    position,
    text: sections.join('\n\n'),
  };
}
