'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, PhoneOff, Mic, MicOff, MessageSquare, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar3D } from '@/components/interview/Avatar3D';
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
  const avatarState = useInterviewStore((s) => s.avatarState);

  const { status, connect, disconnect, sendTextEvent } = useRealtimeSession();
  const { permissions, micStream, camStream, micError, requestMicrophone, requestCamera, stopAllStreams } =
    useMediaPermissions();
  const { isTimeUp, isWarning } = useElapsedTimer();

  const [isMuted, setIsMuted] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [noMic, setNoMic] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const initCalledRef = useRef(false);
  const navigatingRef = useRef(false);
  const warningSentRef = useRef(false);

  const interviewer = interviewSetup?.interviewers[0];

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
      let audioStream = await requestMicrophone();
      if (!audioStream) {
        console.warn('마이크 없음 — 무음 오디오 트랙으로 대체');
        const ctx = new AudioContext();
        const oscillator = ctx.createOscillator();
        const dest = ctx.createMediaStreamDestination();
        oscillator.connect(dest);
        oscillator.start();
        const gain = ctx.createGain();
        gain.gain.value = 0;
        oscillator.disconnect();
        oscillator.connect(gain);
        gain.connect(dest);
        audioStream = dest.stream;
        setNoMic(true);
      }

      await requestCamera();

      const res = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interviewSetup }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '세션 생성에 실패했습니다.');
      }

      await connect(data.clientSecret, audioStream);
    } catch (err) {
      setInitError(
        err instanceof Error ? err.message : '면접 세션을 시작할 수 없습니다.'
      );
    }
  }, [interviewSetup, requestMicrophone, requestCamera, connect]);

  useEffect(() => {
    if (interviewSetup && status === 'idle' && !initCalledRef.current) {
      initCalledRef.current = true;
      initSession();
    }
  }, [interviewSetup, status, initSession]);

  const handleEndInterview = useCallback(() => {
    if (navigatingRef.current) return;
    navigatingRef.current = true;
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

  useEffect(() => {
    if (isWarning && isInterviewActive && !warningSentRef.current) {
      warningSentRef.current = true;
      sendTextEvent('[시스템 알림] 면접 시간이 5분 남았습니다. 남은 질문을 마무리해주세요.');
    }
  }, [isWarning, isInterviewActive, sendTextEvent]);

  useEffect(() => {
    if (isTimeUp && isInterviewActive) {
      handleEndInterview();
    }
  }, [isTimeUp, isInterviewActive, handleEndInterview]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isInterviewActive) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isInterviewActive]);

  useEffect(() => {
    if (status === 'disconnected' && isInterviewActive === false && !navigatingRef.current) {
      navigatingRef.current = true;
      const timeout = setTimeout(() => {
        stopAllStreams();
        router.push('/feedback');
      }, 1000);
      return () => clearTimeout(timeout);
    }
  }, [status, isInterviewActive, router, stopAllStreams]);

  if (!interviewSetup) return null;

  // 에러 화면
  if (status === 'error' || initError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#2a2520] px-4">
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
      <div className="flex min-h-screen items-center justify-center bg-[#2a2520] px-4">
        <Card className="w-full max-w-sm border-0 bg-black/30 backdrop-blur">
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <Loader2 className="h-10 w-10 animate-spin text-white/60" />
            <p className="text-sm font-medium text-white/60">
              {permissions.microphone === null
                ? '마이크 권한을 요청하고 있습니다...'
                : '면접실에 입장하고 있습니다...'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ===== 면접 진행: 풀스크린 3D + 오버레이 UI =====
  return (
    <div className="relative h-screen w-screen overflow-hidden select-none">
      {/* 레이어 1: 풀스크린 3D 면접실 */}
      <Avatar3D />

      {/* 레이어 2: 오버레이 UI */}

      {/* 상단 바 */}
      <div className="absolute top-0 inset-x-0 z-10">
        {/* 마이크 없음 경고 */}
        {noMic && (
          <div className="bg-yellow-500/90 px-4 py-1.5 text-center text-xs text-white font-medium">
            마이크가 감지되지 않았습니다. 면접관 음성은 들을 수 있지만 답변은 전달되지 않습니다.
          </div>
        )}
        <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/50 to-transparent">
          <div className="flex items-center gap-3">
            {/* 면접관 정보 + 상태 */}
            {interviewer && (
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-sm font-medium text-white/90">
                  {interviewer.name}
                </span>
                <span className="text-xs text-white/50">
                  {interviewer.role}
                </span>
                <span
                  className={`ml-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    avatarState === 'speaking'
                      ? 'bg-emerald-500/80 text-white'
                      : avatarState === 'listening'
                        ? 'bg-blue-500/80 text-white'
                        : 'bg-white/20 text-white/60'
                  }`}
                >
                  {avatarState === 'speaking'
                    ? '말하는 중'
                    : avatarState === 'listening'
                      ? '듣는 중'
                      : '대기'}
                </span>
              </div>
            )}
          </div>
          <Timer />
        </div>
      </div>

      {/* 우하단: 카메라 PIP */}
      <div className="absolute bottom-24 right-4 z-10">
        <div className="rounded-xl overflow-hidden shadow-2xl border border-white/10">
          <CameraPip stream={camStream} />
        </div>
      </div>

      {/* 하단: 대화록 패널 (접기/펼치기) */}
      <div
        className={`absolute bottom-24 left-4 z-10 transition-all duration-300 ${
          showTranscript ? 'w-[420px] h-[320px]' : 'w-auto h-auto'
        }`}
      >
        {showTranscript ? (
          <div className="flex h-full flex-col rounded-xl bg-black/60 backdrop-blur-md border border-white/10 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
              <span className="text-xs font-medium text-white/70">대화록</span>
              <button
                onClick={() => setShowTranscript(false)}
                className="text-white/40 hover:text-white/80 transition-colors"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden p-3">
              <TranscriptPanel />
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowTranscript(true)}
            className="flex items-center gap-2 rounded-xl bg-black/50 backdrop-blur-md border border-white/10 px-4 py-2.5 text-white/70 hover:text-white hover:bg-black/60 transition-all"
          >
            <MessageSquare className="h-4 w-4" />
            <span className="text-xs font-medium">대화록</span>
          </button>
        )}
      </div>

      {/* 하단 중앙: 컨트롤 바 */}
      <div className="absolute bottom-0 inset-x-0 z-10">
        <div className="flex items-center justify-center gap-4 px-4 py-4 bg-gradient-to-t from-black/60 to-transparent">
          <Button
            variant="ghost"
            size="icon"
            className={`h-14 w-14 rounded-full border-2 backdrop-blur transition-all ${
              isMuted
                ? 'border-red-500 bg-red-500/20 text-red-400 hover:bg-red-500/30 hover:text-red-300'
                : 'border-white/20 bg-white/10 text-white hover:bg-white/20'
            }`}
            onClick={toggleMute}
          >
            {isMuted ? (
              <MicOff className="h-6 w-6" />
            ) : (
              <Mic className="h-6 w-6" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="lg"
            className="rounded-full border-2 border-red-500 bg-red-500/20 px-8 py-3 text-red-400 hover:bg-red-500/30 hover:text-red-300 backdrop-blur"
            onClick={handleEndInterview}
          >
            <PhoneOff className="mr-2 h-5 w-5" />
            면접 종료
          </Button>
        </div>
      </div>
    </div>
  );
}
