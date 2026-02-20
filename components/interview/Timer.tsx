'use client';

import { Clock } from 'lucide-react';
import { useElapsedTimer } from '@/hooks/useElapsedTimer';

const MAX_INTERVIEW_SECONDS = 30 * 60;

export function Timer() {
  const { elapsedSeconds, formattedTime, isWarning, isTimeUp } = useElapsedTimer();

  const remainingSeconds = Math.max(0, MAX_INTERVIEW_SECONDS - elapsedSeconds);
  const remainingMin = Math.floor(remainingSeconds / 60);
  const remainingSec = remainingSeconds % 60;

  return (
    <div
      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-mono font-medium transition-colors ${
        isTimeUp
          ? 'bg-red-500/30 text-red-300'
          : isWarning
            ? 'bg-yellow-500/30 text-yellow-300'
            : 'bg-white/10 text-white/70'
      }`}
    >
      <Clock className="h-3.5 w-3.5" />
      {formattedTime}
      {isWarning && !isTimeUp && (
        <span className="text-[10px]">({remainingMin}분 {remainingSec > 0 ? `${remainingSec}초` : ''} 남음)</span>
      )}
      {isTimeUp && <span className="text-[10px]">(시간 초과)</span>}
    </div>
  );
}
