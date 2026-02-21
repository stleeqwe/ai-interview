'use client';

import { useEffect, useRef } from 'react';
import { useInterviewStore } from '@/stores/interviewStore';

const MAX_INTERVIEW_SECONDS = 10 * 60; // 10분
const WARNING_SECONDS = 8 * 60; // 8분

interface UseElapsedTimerReturn {
  elapsedSeconds: number;
  isWarning: boolean;
  isTimeUp: boolean;
  formattedTime: string;
}

export function useElapsedTimer(): UseElapsedTimerReturn {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedSeconds = useInterviewStore((s) => s.elapsedSeconds);
  const isInterviewActive = useInterviewStore((s) => s.isInterviewActive);
  const incrementTimer = useInterviewStore((s) => s.incrementTimer);

  useEffect(() => {
    if (isInterviewActive && elapsedSeconds < MAX_INTERVIEW_SECONDS) {
      intervalRef.current = setInterval(() => {
        incrementTimer();
      }, 1000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isInterviewActive, elapsedSeconds >= MAX_INTERVIEW_SECONDS, incrementTimer]);

  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return {
    elapsedSeconds,
    isWarning: elapsedSeconds >= WARNING_SECONDS && elapsedSeconds < MAX_INTERVIEW_SECONDS,
    isTimeUp: elapsedSeconds >= MAX_INTERVIEW_SECONDS,
    formattedTime,
  };
}
