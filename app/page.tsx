'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Mic } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ResumeUploader } from '@/components/upload/ResumeUploader';
import { JobPostingInput } from '@/components/upload/JobPostingInput';
import { useInterviewStore } from '@/stores/interviewStore';

export default function Home() {
  const router = useRouter();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resumeText = useInterviewStore((s) => s.resumeText);
  const jobPostingText = useInterviewStore((s) => s.jobPostingText);
  const interviewSetup = useInterviewStore((s) => s.interviewSetup);
  const setInterviewSetup = useInterviewStore((s) => s.setInterviewSetup);
  const setGroundingReport = useInterviewStore((s) => s.setGroundingReport);
  const setClaudeMetrics = useInterviewStore((s) => s.setClaudeMetrics);

  const isReady = !!resumeText && !!jobPostingText;
  const hasExistingSetup = !!interviewSetup;

  const handleStartAnalysis = async () => {
    if (!resumeText || !jobPostingText) return;

    setError(null);
    setIsAnalyzing(true);

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeText, jobPostingText }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '면접 분석에 실패했습니다.');
      }

      // 모니터링 데이터 추출 후 분리
      const { _groundingReport, _claudeMetrics, ...interviewSetup } = data;
      if (_groundingReport) setGroundingReport(_groundingReport);
      if (_claudeMetrics) setClaudeMetrics(_claudeMetrics);
      setInterviewSetup(interviewSetup);
      router.push('/loading');
    } catch (err) {
      setError(err instanceof Error ? err.message : '분석 요청에 실패했습니다.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-background to-muted/30 px-4 py-12">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Mic className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">AI 모의면접</CardTitle>
          <CardDescription>
            이력서와 채용공고를 입력하면 AI가 맞춤형 기술면접을 진행합니다
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium">이력서</label>
            <ResumeUploader />
          </div>

          <Separator />

          <div className="space-y-2">
            <label className="text-sm font-medium">채용공고</label>
            <JobPostingInput />
          </div>

          <Separator />

          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}

          {hasExistingSetup && (
            <div className="space-y-2 rounded-lg border border-primary/20 bg-primary/5 p-4">
              <p className="text-sm font-medium text-primary">
                저장된 면접 시나리오가 있습니다
              </p>
              <p className="text-xs text-muted-foreground">
                {interviewSetup.company_analysis?.company_name} · {interviewSetup.company_analysis?.position}
              </p>
              <Button
                className="w-full"
                size="lg"
                onClick={() => router.push('/interview')}
              >
                <Mic className="mr-2 h-4 w-4" />
                바로 면접 시작
              </Button>
              <Button
                variant="ghost"
                className="w-full"
                size="sm"
                onClick={() => {
                  useInterviewStore.getState().reset();
                  setError(null);
                }}
              >
                시나리오 초기화 (새로 분석)
              </Button>
            </div>
          )}

          <Separator />

          <Button
            className="w-full"
            size="lg"
            variant={hasExistingSetup ? 'outline' : 'default'}
            disabled={!isReady || isAnalyzing}
            onClick={handleStartAnalysis}
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                면접 시나리오 분석 중...
              </>
            ) : hasExistingSetup ? (
              '새 시나리오로 다시 분석'
            ) : (
              '면접 시작하기'
            )}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            마이크 권한이 필요합니다 · 면접 시간은 최대 30분입니다
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
