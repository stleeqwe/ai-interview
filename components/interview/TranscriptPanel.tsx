'use client';

import { useEffect, useRef } from 'react';
import { useInterviewStore, TranscriptEntry } from '@/stores/interviewStore';

interface TranscriptPanelProps {
  isAiThinking?: boolean;
}

export function TranscriptPanel({ isAiThinking }: TranscriptPanelProps) {
  const transcript = useInterviewStore((s) => s.transcript);
  const interviewSetup = useInterviewStore((s) => s.interviewSetup);
  const scrollRef = useRef<HTMLDivElement>(null);

  const interviewerName = interviewSetup?.interviewers[0]?.name ?? '면접관';

  // 새 항목 추가 시 자동 스크롤
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcript.length, isAiThinking]);

  if (transcript.length === 0 && !isAiThinking) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-white/40">
        면접이 시작되면 대화 내용이 여기에 표시됩니다
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto space-y-2.5 pr-1 scrollbar-thin">
      {transcript.map((entry: TranscriptEntry, idx: number) => (
        <div
          key={idx}
          className={`flex flex-col ${
            entry.speaker === 'interviewer' ? 'items-start' : 'items-end'
          }`}
        >
          <span className="mb-0.5 text-[10px] font-medium text-white/40">
            {entry.speaker === 'interviewer' ? interviewerName : '나'}
          </span>
          <div
            className={`max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed ${
              entry.speaker === 'interviewer'
                ? 'bg-white/10 text-white/90'
                : 'bg-blue-500/30 text-blue-100'
            }`}
          >
            {entry.text}
          </div>
        </div>
      ))}

      {/* AI 생각 중 인디케이터 */}
      {isAiThinking && (
        <div className="flex flex-col items-start">
          <span className="mb-0.5 text-[10px] font-medium text-white/40">
            {interviewerName}
          </span>
          <div className="rounded-lg bg-white/10 px-3 py-2 text-sm text-white/50">
            <span className="inline-flex items-center gap-1">
              <span className="animate-bounce" style={{ animationDelay: '0ms' }}>.</span>
              <span className="animate-bounce" style={{ animationDelay: '150ms' }}>.</span>
              <span className="animate-bounce" style={{ animationDelay: '300ms' }}>.</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
