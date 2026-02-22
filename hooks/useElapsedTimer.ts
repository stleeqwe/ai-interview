'use client';

import { useEffect, useRef } from 'react';
import { useInterviewStore } from '@/stores/interviewStore';
import { INTERVIEW_MAX_SECONDS, INTERVIEW_WARNING_SECONDS } from '@/lib/constants';

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
    if (isInterviewActive && elapsedSeconds < INTERVIEW_MAX_SECONDS) {
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
  }, [isInterviewActive, elapsedSeconds >= INTERVIEW_MAX_SECONDS, incrementTimer]);

  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return {
    elapsedSeconds,
    isWarning: elapsedSeconds >= INTERVIEW_WARNING_SECONDS && elapsedSeconds < INTERVIEW_MAX_SECONDS,
    isTimeUp: elapsedSeconds >= INTERVIEW_MAX_SECONDS,
    formattedTime,
  };
}
