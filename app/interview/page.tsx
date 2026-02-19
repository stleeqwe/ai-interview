'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, PhoneOff, Mic, MicOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar } from '@/components/interview/Avatar';
import { Timer } from '@/components/interview/Timer';
import { TranscriptPanel } from '@/components/interview/TranscriptPanel';
import { CameraPip } from '@/components/interview/CameraPip';
import { useInterviewStore } from '@/stores/interviewStore';
import { useRealtimeSession } from '@/hooks/useRealtimeSession';
import { useMediaPermissions } from '@/hooks/useMediaPermissions';
import { useElapsedTimer } from '@/hooks/useElapsedTimer';

export default function InterviewPage() {
  const router = useRouter();
  const interviewSetup = useInterviewStore((s) => s.interviewSetup);
  const isInterviewActive = useInterviewStore((s) => s.isInterviewActive);

  const { status, connect, disconnect } = useRealtimeSession();
  const { permissions, micStream, camStream, micError, requestMicrophone, requestCamera, stopAllStreams } =
    useMediaPermissions();
  const { isTimeUp } = useElapsedTimer();

  const [isMuted, setIsMuted] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [noMic, setNoMic] = useState(false);
  const initCalledRef = useRef(false);

  // 면접 설정이 없으면 홈으로
  useEffect(() => {
    if (!interviewSetup) {
      router.replace('/');
    }
  }, [interviewSetup, router]);

  // 면접 세션 초기화
  const initSession = useCallback(async () => {
    if (!interviewSetup) return;
    setInitError(null);

    try {
      // 1. 마이크 권한 요청 (없으면 무음 트랙으로 대체)
      let audioStream = await requestMicrophone();
      if (!audioStream) {
        console.warn('마이크 없음 — 무음 오디오 트랙으로 대체');
        const ctx = new AudioContext();
        const oscillator = ctx.createOscillator();
        const dest = ctx.createMediaStreamDestination();
        oscillator.connect(dest);
        oscillator.start();
        // 무음 처리: gain 0
        const gain = ctx.createGain();
        gain.gain.value = 0;
        oscillator.disconnect();
        oscillator.connect(gain);
        gain.connect(dest);
        audioStream = dest.stream;
        setNoMic(true);
      }

      // 2. 카메라 요청 (선택적, 실패해도 계속 진행)
      await requestCamera();

      // 3. 세션 토큰 발급
      const res = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interviewSetup }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '세션 생성에 실패했습니다.');
      }

      // 4. WebRTC 연결
      await connect(data.clientSecret, audioStream);
    } catch (err) {
      setInitError(
        err instanceof Error ? err.message : '면접 세션을 시작할 수 없습니다.'
      );
    }
  }, [interviewSetup, requestMicrophone, requestCamera, connect]);

  // 페이지 진입 시 자동 세션 초기화 (Strict Mode 이중 호출 방지)
  useEffect(() => {
    if (interviewSetup && status === 'idle' && !initCalledRef.current) {
      initCalledRef.current = true;
      initSession();
    }
  }, [interviewSetup, status, initSession]);

  // 시간 초과 시 면접 종료
  useEffect(() => {
    if (isTimeUp && isInterviewActive) {
      handleEndInterview();
    }
  }, [isTimeUp, isInterviewActive]);

  // 페이지 이탈 방지
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isInterviewActive) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isInterviewActive]);

  const handleEndInterview = useCallback(() => {
    disconnect();
    stopAllStreams();
    router.push('/feedback');
  }, [disconnect, stopAllStreams, router]);

  const toggleMute = () => {
    if (micStream) {
      micStream.getAudioTracks().forEach((t) => {
        t.enabled = isMuted;
      });
      setIsMuted(!isMuted);
    }
  };

  // 면접 종료 상태 감지 (WebRTC 연결 끊김)
  useEffect(() => {
    if (status === 'disconnected' && isInterviewActive === false) {
      // 세션이 끊어지고 store에서 inactive로 설정된 경우 → 피드백으로 이동
      const timeout = setTimeout(() => {
        stopAllStreams();
        router.push('/feedback');
      }, 1000);
      return () => clearTimeout(timeout);
    }
  }, [status, isInterviewActive, router, stopAllStreams]);

  if (!interviewSetup) return null;

  // 에러 화면 (연결 중 화면보다 우선)
  if (status === 'error' || initError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-sm">
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <p className="text-sm text-destructive text-center">
              {initError || '연결에 실패했습니다.'}
            </p>
            {micError && !noMic && (
              <p className="text-xs text-muted-foreground text-center font-mono bg-muted rounded p-2">
                {micError}
              </p>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => router.push('/')}>
                돌아가기
              </Button>
              <Button onClick={() => { initCalledRef.current = false; initSession(); }}>다시 시도</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 연결 중 화면
  if (status === 'connecting' || status === 'idle') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-sm">
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm font-medium text-muted-foreground">
              {permissions.microphone === null
                ? '마이크 권한을 요청하고 있습니다...'
                : '면접관과 연결하고 있습니다...'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 면접 진행 화면
  return (
    <div className="flex h-screen flex-col bg-background">
      {/* 마이크 없음 경고 */}
      {noMic && (
        <div className="bg-yellow-100 px-4 py-2 text-center text-xs text-yellow-800">
          마이크가 감지되지 않았습니다. 면접관 음성은 들을 수 있지만 답변은 전달되지 않습니다.
        </div>
      )}
      {/* 상단 바 */}
      <header className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold">
            {interviewSetup.company_analysis.company_name} 모의면접
          </h1>
          <span className="text-xs text-muted-foreground">
            {interviewSetup.company_analysis.position}
          </span>
        </div>
        <Timer />
      </header>

      {/* 메인 컨텐츠 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 왼쪽: 아바타 + 카메라 */}
        <div className="flex w-64 flex-col items-center justify-center gap-6 border-r bg-muted/30 p-4">
          <Avatar />
          <CameraPip stream={camStream} />
        </div>

        {/* 오른쪽: 대화록 */}
        <div className="flex flex-1 flex-col">
          <div className="flex-1 overflow-hidden p-4">
            <TranscriptPanel />
          </div>

          {/* 하단 컨트롤 */}
          <div className="flex items-center justify-center gap-3 border-t p-4">
            <Button
              variant={isMuted ? 'destructive' : 'outline'}
              size="icon"
              className="h-12 w-12 rounded-full"
              onClick={toggleMute}
            >
              {isMuted ? (
                <MicOff className="h-5 w-5" />
              ) : (
                <Mic className="h-5 w-5" />
              )}
            </Button>
            <Button
              variant="destructive"
              size="lg"
              className="rounded-full px-6"
              onClick={handleEndInterview}
            >
              <PhoneOff className="mr-2 h-4 w-4" />
              면접 종료
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
