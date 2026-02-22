'use client';

import { useRef, useCallback, useState } from 'react';
import { useInterviewStore } from '@/stores/interviewStore';
import { useMonitorStore } from '@/stores/monitorStore';

type SessionStatus = 'idle' | 'connecting' | 'connected' | 'sending' | 'disconnected' | 'error';

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

interface UseChatSessionReturn {
  status: SessionStatus;
  isAiThinking: boolean;
  startInterview: () => Promise<void>;
  sendMessage: (text: string) => Promise<void>;
  endInterview: () => void;
}

export function useChatSession(): UseChatSessionReturn {
  const [status, setStatus] = useState<SessionStatus>('idle');
  const [isAiThinking, setIsAiThinking] = useState(false);
  const historyRef = useRef<ChatMessage[]>([]);
  const endingRef = useRef(false);

  const callChatAPI = useCallback(async (userMessage?: string) => {
    const store = useInterviewStore.getState();
    const interviewSetup = store.interviewSetup;
    if (!interviewSetup) throw new Error('면접 설정이 없습니다.');

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        interviewSetup,
        history: historyRef.current,
        userMessage,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || '채팅 요청에 실패했습니다.');
    }

    // 모니터링: chat metrics
    if (data._chatMetrics) {
      const monitor = useMonitorStore.getState();
      monitor.addTimelineEvent('stage2', 'chat.response', data._chatMetrics.durationMs);
    }

    return data as { reply: string; isInterviewEnd: boolean };
  }, []);

  const endInterview = useCallback(() => {
    setStatus('disconnected');
    setIsAiThinking(false);
    useInterviewStore.getState().setInterviewActive(false);
    useInterviewStore.getState().setAvatarState('idle');
    const monitor = useMonitorStore.getState();
    monitor.addTimelineEvent('stage2', 'chat.ended');
    monitor.flushToIndexedDB();
  }, []);

  const startInterview = useCallback(async () => {
    if (status !== 'idle') return;
    setStatus('connecting');
    setIsAiThinking(true);
    historyRef.current = [];
    endingRef.current = false;

    try {
      const data = await callChatAPI();

      // 첫 메시지를 이력에 추가
      historyRef.current.push(
        { role: 'user', text: '면접을 시작해주세요. 간단히 인사하고 바로 첫 번째 질문으로 넘어가주세요.' },
        { role: 'model', text: data.reply },
      );

      // 트랜스크립트에 면접관 응답 추가
      const store = useInterviewStore.getState();
      store.addTranscript({
        speaker: 'interviewer',
        text: data.reply,
        timestamp: Date.now(),
      });
      store.setInterviewActive(true);
      store.setAvatarState('speaking');
      setTimeout(() => {
        useInterviewStore.getState().setAvatarState('listening');
      }, 2000);

      setStatus('connected');
      setIsAiThinking(false);

      useMonitorStore.getState().addTimelineEvent('stage2', 'chat.started');
    } catch (error) {
      console.error('면접 시작 실패:', error);
      setStatus('error');
      setIsAiThinking(false);
      useMonitorStore.getState().addError({
        stage: 'stage2',
        category: 'gemini.chat',
        severity: 'error',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }, [status, callChatAPI]);

  const sendMessage = useCallback(async (text: string) => {
    if (status !== 'connected' || endingRef.current) return;

    const store = useInterviewStore.getState();

    // 사용자 답변 트랜스크립트 추가
    store.addTranscript({
      speaker: 'candidate',
      text,
      timestamp: Date.now(),
    });

    // 이력에 사용자 메시지 추가
    historyRef.current.push({ role: 'user', text });

    setStatus('sending');
    setIsAiThinking(true);
    store.setAvatarState('idle');

    try {
      const data = await callChatAPI(text);

      // 이력에 AI 응답 추가
      historyRef.current.push({ role: 'model', text: data.reply });

      // 트랜스크립트에 면접관 응답 추가
      store.addTranscript({
        speaker: 'interviewer',
        text: data.reply,
        timestamp: Date.now(),
      });

      store.setAvatarState('speaking');
      setTimeout(() => {
        useInterviewStore.getState().setAvatarState('listening');
      }, 2000);

      setIsAiThinking(false);
      setStatus('connected');

      // [INTERVIEW_END] 감지 시 2초 후 종료
      if (data.isInterviewEnd) {
        endingRef.current = true;
        setTimeout(() => {
          endInterview();
        }, 2000);
      }
    } catch (error) {
      console.error('메시지 전송 실패:', error);
      setIsAiThinking(false);
      setStatus('connected'); // 에러 후에도 계속 사용 가능하도록
      useMonitorStore.getState().addError({
        stage: 'stage2',
        category: 'gemini.chat',
        severity: 'error',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }, [status, callChatAPI, endInterview]);

  return { status, isAiThinking, startInterview, sendMessage, endInterview };
}
