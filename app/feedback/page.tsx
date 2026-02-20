'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { OverallGrade } from '@/components/feedback/OverallGrade';
import { QuestionEvaluation } from '@/components/feedback/QuestionEvaluation';
import { SkillRadar } from '@/components/feedback/SkillRadar';
import { ActionItems } from '@/components/feedback/ActionItems';
import { useInterviewStore, formatTranscript } from '@/stores/interviewStore';

export default function FeedbackPage() {
  const router = useRouter();
  const interviewSetup = useInterviewStore((s) => s.interviewSetup);
  const transcript = useInterviewStore((s) => s.transcript);
  const evaluation = useInterviewStore((s) => s.evaluation);
  const setEvaluation = useInterviewStore((s) => s.setEvaluation);
  const resumeText = useInterviewStore((s) => s.resumeText);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 면접 데이터가 없으면 홈으로
  useEffect(() => {
    if (!interviewSetup || transcript.length === 0) {
      router.replace('/');
    }
  }, [interviewSetup, transcript, router]);

  // 평가 요청
  useEffect(() => {
    if (!interviewSetup || transcript.length === 0 || evaluation) return;

    const fetchEvaluation = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const interviewerName = interviewSetup.interviewers[0]?.name ?? '면접관';
        const transcriptText = formatTranscript(transcript, interviewerName);

        const res = await fetch('/api/evaluate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            interviewSetup,
            transcript: transcriptText,
            resumeText: resumeText ?? undefined,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || '평가 생성에 실패했습니다.');
        }

        setEvaluation(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : '평가 요청에 실패했습니다.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchEvaluation();
  }, [interviewSetup, transcript, evaluation, setEvaluation, resumeText]);

  const handleRetry = () => {
    setError(null);
    setEvaluation(null);
  };

  const handleNewInterview = () => {
    useInterviewStore.getState().reset();
    router.push('/');
  };

  if (!interviewSetup || transcript.length === 0) return null;

  // 로딩 중
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-sm">
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <div className="text-center">
              <p className="text-sm font-medium">면접 평가 리포트 생성 중...</p>
              <p className="mt-1 text-xs text-muted-foreground">
                AI가 면접 내용을 분석하고 있습니다
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 에러
  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-sm">
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <p className="text-sm text-destructive text-center">{error}</p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleNewInterview}>
                처음으로
              </Button>
              <Button onClick={handleRetry}>다시 시도</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 평가 결과 표시
  if (!evaluation) return null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">면접 평가 리포트</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {interviewSetup.company_analysis.company_name} —{' '}
              {interviewSetup.company_analysis.position}
            </p>
          </div>
          <Button variant="outline" onClick={handleNewInterview}>
            <RotateCcw className="mr-2 h-4 w-4" />
            새 면접
          </Button>
        </div>

        <OverallGrade evaluation={evaluation.overall_evaluation} />

        <div className="grid gap-6 md:grid-cols-2">
          <SkillRadar skills={evaluation.skill_radar} />
          <ActionItems items={evaluation.action_items} />
        </div>

        <QuestionEvaluation questions={evaluation.question_evaluations} />
      </div>
    </div>
  );
}
