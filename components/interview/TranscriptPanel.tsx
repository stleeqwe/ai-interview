'use client';

import { useEffect, useRef } from 'react';
import { useInterviewStore, TranscriptEntry } from '@/stores/interviewStore';

export function TranscriptPanel() {
  const transcript = useInterviewStore((s) => s.transcript);
  const interviewSetup = useInterviewStore((s) => s.interviewSetup);
  const scrollRef = useRef<HTMLDivElement>(null);

  const interviewerName = interviewSetup?.interviewers[0]?.name ?? '면접관';

  // 새 항목 추가 시 자동 스크롤
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcript.length]);

  if (transcript.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        면접이 시작되면 대화 내용이 여기에 표시됩니다
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto space-y-3 pr-2">
      {transcript.map((entry: TranscriptEntry, idx: number) => (
        <div
          key={idx}
          className={`flex flex-col ${
            entry.speaker === 'interviewer' ? 'items-start' : 'items-end'
          }`}
        >
          <span className="mb-0.5 text-[10px] font-medium text-muted-foreground">
            {entry.speaker === 'interviewer' ? interviewerName : '나'}
          </span>
          <div
            className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
              entry.speaker === 'interviewer'
                ? 'bg-muted text-foreground'
                : 'bg-primary text-primary-foreground'
            }`}
          >
            {entry.text}
          </div>
        </div>
      ))}
    </div>
  );
}
