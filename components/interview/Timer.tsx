'use client';

import { Clock } from 'lucide-react';
import { useElapsedTimer } from '@/hooks/useElapsedTimer';

export function Timer() {
  const { formattedTime, isWarning, isTimeUp } = useElapsedTimer();

  return (
    <div
      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-mono font-medium transition-colors ${
        isTimeUp
          ? 'bg-destructive/10 text-destructive'
          : isWarning
            ? 'bg-yellow-100 text-yellow-700'
            : 'bg-muted text-muted-foreground'
      }`}
    >
      <Clock className="h-3.5 w-3.5" />
      {formattedTime}
      {isWarning && <span className="text-[10px]">(5분 남음)</span>}
      {isTimeUp && <span className="text-[10px]">(시간 초과)</span>}
    </div>
  );
}
