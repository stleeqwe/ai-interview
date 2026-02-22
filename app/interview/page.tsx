'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, PhoneOff, Mic, MicOff, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar3D } from '@/components/interview/Avatar3D';
import { Timer } from '@/components/interview/Timer';
import { TranscriptPanel } from '@/components/interview/TranscriptPanel';
import { useInterviewStore } from '@/stores/interviewStore';
import { useMonitorStore } from '@/stores/monitorStore';
import { useChatSession } from '@/hooks/useChatSession';
import { useSpeechToText } from '@/hooks/useSpeechToText';
import { useInterviewStore as useTimerStore } from '@/stores/interviewStore';

export default function InterviewPage() {
  const router = useRouter();
  const interviewSetup = useInterviewStore((s) => s.interviewSetup);
  const isInterviewActive = useInterviewStore((s) => s.isInterviewActive);
  const avatarState = useInterviewStore((s) => s.avatarState);

  const { status, isAiThinking, startInterview, sendMessage, endInterview } = useChatSession();
  const { isListening, transcript: sttTranscript, isSupported: sttSupported, startListening, stopListening, resetTranscript } = useSpeechToText();

  const elapsedSeconds = useTimerStore((s) => s.elapsedSeconds);
  const isWarning = elapsedSeconds >= 8 * 60 && elapsedSeconds < 10 * 60;
  const isTimeUp = elapsedSeconds >= 10 * 60;

  const [inputText, setInputText] = useState('');
  const [initError, setInitError] = useState<string | null>(null);
  const initCalledRef = useRef(false);
  const navigatingRef = useRef(false);
  const warningSentRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const interviewer = interviewSetup?.interviewers[0];

  // STT transcript → 입력 필드 동기화 (외부 시스템인 SpeechRecognition API에서 오는 값)
  useEffect(() => {
    if (sttTranscript) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- SpeechRecognition API 콜백에서 오는 외부 상태 동기화
      setInputText(sttTranscript);
    }
  }, [sttTranscript]);

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
      const monitor = useMonitorStore.getState();
      monitor.addTimelineEvent('stage2', 'chat_init.started');
      await startInterview();
    } catch (err) {
      setInitError(
        err instanceof Error ? err.message : '면접 세션을 시작할 수 없습니다.'
      );
    }
  }, [interviewSetup, startInterview]);

  // 자동 면접 시작 (마운트 시 1회)
  useEffect(() => {
    if (interviewSetup && status === 'idle' && !initCalledRef.current) {
      initCalledRef.current = true;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 마운트 시 1회 API 호출 초기화
      initSession();
    }
  }, [interviewSetup, status, initSession]);

  const handleSendMessage = useCallback(async () => {
    const text = inputText.trim();
    if (!text || isAiThinking) return;

    setInputText('');
    resetTranscript();
    if (isListening) stopListening();

    await sendMessage(text);

    // 전송 후 textarea에 포커스
    setTimeout(() => textareaRef.current?.focus(), 100);
  }, [inputText, isAiThinking, sendMessage, resetTranscript, isListening, stopListening]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleEndInterview = useCallback(() => {
    if (navigatingRef.current) return;
    navigatingRef.current = true;
    endInterview();
    if (isListening) stopListening();
    router.push('/feedback');
  }, [endInterview, isListening, stopListening, router]);

  const toggleSTT = () => {
    if (isListening) {
      stopListening();
    } else {
      resetTranscript();
      startListening();
    }
  };

  // 8분 경고
  useEffect(() => {
    if (isWarning && isInterviewActive && !warningSentRef.current) {
      warningSentRef.current = true;
      sendMessage('[시스템 알림] 면접 시간이 2분 남았습니다. 남은 질문을 마무리해주세요.', { isSystemMessage: true });
    }
  }, [isWarning, isInterviewActive, sendMessage]);

  // 10분 타임아웃
  useEffect(() => {
    if (isTimeUp && isInterviewActive) {
      handleEndInterview();
    }
  }, [isTimeUp, isInterviewActive, handleEndInterview]);

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

  // 면접 종료 시 자동 네비게이션
  useEffect(() => {
    if (status === 'disconnected' && isInterviewActive === false && !navigatingRef.current) {
      navigatingRef.current = true;
      const timeout = setTimeout(() => {
        router.push('/feedback');
      }, 1000);
      return () => clearTimeout(timeout);
    }
  }, [status, isInterviewActive, router]);

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
              면접실에 입장하고 있습니다...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ===== 면접 진행: 아바타 + 채팅 레이아웃 =====
  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden select-none bg-[#2a2520]">
      {/* 상단 바 */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/50 to-transparent z-10">
        <div className="flex items-center gap-3">
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

      {/* 아바타 영역 (상단 35%) */}
      <div className="relative" style={{ height: '35%' }}>
        <Avatar3D />
      </div>

      {/* 대화록 패널 (중단 45%) */}
      <div className="flex-1 overflow-hidden px-4 py-2">
        <div className="h-full rounded-xl bg-black/40 backdrop-blur-md border border-white/10 p-3 overflow-hidden">
          <TranscriptPanel isAiThinking={isAiThinking} />
        </div>
      </div>

      {/* 입력 영역 (하단) */}
      <div className="px-4 pb-4 pt-2">
        <div className="flex items-end gap-2">
          {/* STT 토글 */}
          {sttSupported && (
            <Button
              variant="ghost"
              size="icon"
              className={`h-10 w-10 shrink-0 rounded-full border backdrop-blur transition-all ${
                isListening
                  ? 'border-red-500 bg-red-500/20 text-red-400 hover:bg-red-500/30'
                  : 'border-white/20 bg-white/10 text-white/70 hover:bg-white/20'
              }`}
              onClick={toggleSTT}
              disabled={isAiThinking}
            >
              {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </Button>
          )}

          {/* 텍스트 입력 */}
          <div className="relative flex-1">
            <textarea
              ref={textareaRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isAiThinking ? 'AI가 생각하고 있습니다...' : '답변을 입력하세요... (Enter로 전송)'}
              disabled={isAiThinking}
              rows={1}
              className="w-full resize-none rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 pr-12 text-sm text-white placeholder:text-white/40 backdrop-blur focus:border-white/40 focus:outline-none disabled:opacity-50"
              style={{ maxHeight: '120px', minHeight: '40px' }}
            />
            <Button
              variant="ghost"
              size="icon"
              className="absolute bottom-1 right-1 h-8 w-8 rounded-lg text-white/60 hover:text-white hover:bg-white/10"
              onClick={handleSendMessage}
              disabled={!inputText.trim() || isAiThinking}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>

          {/* 면접 종료 */}
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0 rounded-full border border-red-500/50 bg-red-500/10 px-4 py-2 text-xs text-red-400 hover:bg-red-500/20 hover:text-red-300 backdrop-blur"
            onClick={handleEndInterview}
          >
            <PhoneOff className="mr-1.5 h-3.5 w-3.5" />
            면접 종료
          </Button>
        </div>
      </div>
    </div>
  );
}
