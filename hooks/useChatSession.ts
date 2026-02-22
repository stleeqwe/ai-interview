'use client';

import { useRef, useCallback, useState } from 'react';
import { useInterviewStore } from '@/stores/interviewStore';
import { useMonitorStore } from '@/stores/monitorStore';
import { AVATAR_SPEAKING_DURATION_MS, INTERVIEW_END_DELAY_MS } from '@/lib/constants';

type SessionStatus = 'idle' | 'connecting' | 'connected' | 'sending' | 'disconnected' | 'error';

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

interface UseChatSessionReturn {
  status: SessionStatus;
  isAiThinking: boolean;
  startInterview: () => Promise<void>;
  sendMessage: (text: string, options?: { isSystemMessage?: boolean }) => Promise<void>;
  endInterview: () => void;
}

function transitionAvatarToListening() {
  useInterviewStore.getState().setAvatarState('speaking');
  setTimeout(() => {
    useInterviewStore.getState().setAvatarState('listening');
  }, AVATAR_SPEAKING_DURATION_MS);
}

export function useChatSession(): UseChatSessionReturn {
  const [status, setStatus] = useState<SessionStatus>('idle');
  const [isAiThinking, setIsAiThinking] = useState(false);
  const historyRef = useRef<ChatMessage[]>([]);
  const endingRef = useRef(false);
  const sendingRef = useRef(false); // BUG 6 fix: mutex for sendMessage

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
    if (status !== 'idle' && status !== 'error') return; // BUG 2 fix: allow retry from error
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
      transitionAvatarToListening();

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

  const sendMessage = useCallback(async (text: string, options?: { isSystemMessage?: boolean }) => {
    if (status !== 'connected' || endingRef.current) return;
    if (sendingRef.current) return; // BUG 6 fix: prevent concurrent sends
    sendingRef.current = true;

    const store = useInterviewStore.getState();

    // BUG 3 fix: 시스템 메시지는 트랜스크립트에 추가하지 않음
    if (!options?.isSystemMessage) {
      store.addTranscript({
        speaker: 'candidate',
        text,
        timestamp: Date.now(),
      });
    }

    setStatus('sending');
    setIsAiThinking(true);
    store.setAvatarState('idle');

    try {
      // BUG 1 fix: historyRef에 push하지 않고 userMessage로만 전달 (서버가 처리)
      const data = await callChatAPI(text);

      // API 호출 후에 이력에 추가 (중복 방지)
      historyRef.current.push({ role: 'user', text });
      historyRef.current.push({ role: 'model', text: data.reply });

      // 트랜스크립트에 면접관 응답 추가
      store.addTranscript({
        speaker: 'interviewer',
        text: data.reply,
        timestamp: Date.now(),
      });

      transitionAvatarToListening();

      setIsAiThinking(false);
      setStatus('connected');

      // [INTERVIEW_END] 감지 시 종료
      if (data.isInterviewEnd) {
        endingRef.current = true;
        setTimeout(() => {
          endInterview();
        }, INTERVIEW_END_DELAY_MS);
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
    } finally {
      sendingRef.current = false; // BUG 6 fix: release mutex
    }
  }, [status, callChatAPI, endInterview]);

  return { status, isAiThinking, startInterview, sendMessage, endInterview };
}
