'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useInterviewStore } from '@/stores/interviewStore';

const STEPS = [
  '이력서 분석 중...',
  '채용공고 분석 중...',
  '질문 시나리오 설계 중...',
  '면접관 프로필 구성 중...',
  '면접 준비 완료!',
];

export default function LoadingPage() {
  const router = useRouter();
  const interviewSetup = useInterviewStore((s) => s.interviewSetup);
  const [step, setStep] = useState(0);
  const [progress, setProgress] = useState(0);

  // 분석 데이터가 없으면 홈으로 리다이렉트
  useEffect(() => {
    if (!interviewSetup) {
      // 아직 분석 중일 수 있으므로 약간 대기
      const timeout = setTimeout(() => {
        const setup = useInterviewStore.getState().interviewSetup;
        if (!setup) {
          router.replace('/');
        }
      }, 1000);
      return () => clearTimeout(timeout);
    }
  }, [interviewSetup, router]);

  // 시각적 진행 단계 애니메이션
  useEffect(() => {
    const stepInterval = setInterval(() => {
      setStep((prev) => {
        if (prev >= STEPS.length - 1) {
          clearInterval(stepInterval);
          return prev;
        }
        return prev + 1;
      });
    }, 800);

    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + 2;
      });
    }, 60);

    return () => {
      clearInterval(stepInterval);
      clearInterval(progressInterval);
    };
  }, []);

  // 분석 완료 + 프로그레스 100% 도달 시 면접 화면으로 이동
  useEffect(() => {
    if (interviewSetup && progress >= 100) {
      const timeout = setTimeout(() => {
        router.push('/interview');
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [interviewSetup, progress, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-background to-muted/30 px-4">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center gap-6 py-12">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />

          <div className="w-full space-y-3">
            <Progress value={progress} className="h-2" />
            <p className="text-center text-sm font-medium text-muted-foreground">
              {STEPS[step]}
            </p>
          </div>

          {interviewSetup && (
            <div className="w-full space-y-2 rounded-lg bg-muted/50 p-4 text-sm">
              <p className="font-medium">
                {interviewSetup.company_analysis.company_name} —{' '}
                {interviewSetup.company_analysis.position}
              </p>
              <p className="text-muted-foreground">
                면접관: {interviewSetup.interviewers[0].name} ({interviewSetup.interviewers[0].role})
              </p>
              <p className="text-muted-foreground">
                질문 {interviewSetup.questions.length}개 준비 완료
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
