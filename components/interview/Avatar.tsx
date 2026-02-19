'use client';

import { useInterviewStore } from '@/stores/interviewStore';
import { User } from 'lucide-react';

export function Avatar() {
  const avatarState = useInterviewStore((s) => s.avatarState);
  const interviewSetup = useInterviewStore((s) => s.interviewSetup);
  const interviewer = interviewSetup?.interviewers[0];

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative">
        <div
          className={`flex h-24 w-24 items-center justify-center rounded-full bg-primary/10 transition-all duration-300 ${
            avatarState === 'speaking'
              ? 'ring-4 ring-primary/40 animate-pulse'
              : avatarState === 'listening'
                ? 'ring-2 ring-blue-400/40'
                : ''
          }`}
        >
          <User className="h-10 w-10 text-primary" />
        </div>
        <div
          className={`absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full px-2 py-0.5 text-[10px] font-medium ${
            avatarState === 'speaking'
              ? 'bg-primary text-primary-foreground'
              : avatarState === 'listening'
                ? 'bg-blue-500 text-white'
                : 'bg-muted text-muted-foreground'
          }`}
        >
          {avatarState === 'speaking'
            ? '말하는 중'
            : avatarState === 'listening'
              ? '듣는 중'
              : '대기'}
        </div>
      </div>
      {interviewer && (
        <div className="text-center">
          <p className="text-sm font-medium">{interviewer.name}</p>
          <p className="text-xs text-muted-foreground">{interviewer.role}</p>
        </div>
      )}
    </div>
  );
}
