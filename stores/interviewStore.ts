import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { InterviewSetupJSON } from '@/lib/schemas/interviewSetup';
import type { EvaluationJSON } from '@/lib/schemas/evaluation';

export interface TranscriptEntry {
  speaker: 'interviewer' | 'candidate';
  text: string;
  timestamp: number;
}

type AvatarState = 'idle' | 'speaking' | 'listening';

interface InterviewState {
  // 화면 1: 업로드
  resumeText: string | null;
  resumeFileName: string | null;
  jobPostingText: string | null;
  jobCompanyName: string | null;
  jobPosition: string | null;

  // 화면 2→3: 분석 결과
  interviewSetup: InterviewSetupJSON | null;

  // 화면 3: 면접 진행
  transcript: TranscriptEntry[];
  avatarState: AvatarState;
  elapsedSeconds: number;
  isInterviewActive: boolean;

  // 화면 4: 평가
  evaluation: EvaluationJSON | null;

  // 액션
  setResumeText: (text: string, fileName: string) => void;
  setJobPostingText: (text: string, companyName?: string, position?: string) => void;
  setInterviewSetup: (setup: InterviewSetupJSON) => void;
  addTranscript: (entry: TranscriptEntry) => void;
  setAvatarState: (state: AvatarState) => void;
  incrementTimer: () => void;
  setInterviewActive: (active: boolean) => void;
  setEvaluation: (evaluation: EvaluationJSON) => void;
  hydrateFromSession: () => void;
  reset: () => void;
}

const SESSION_STORAGE_KEY = 'ai-interview-setup';

function loadInterviewSetup(): InterviewSetupJSON | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

function saveInterviewSetup(setup: InterviewSetupJSON | null) {
  if (typeof window === 'undefined') return;
  try {
    if (setup) {
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(setup));
    } else {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    }
  } catch { /* sessionStorage 용량 초과 등 무시 */ }
}

const initialState = {
  resumeText: null,
  resumeFileName: null,
  jobPostingText: null,
  jobCompanyName: null,
  jobPosition: null,
  interviewSetup: null as InterviewSetupJSON | null,
  transcript: [],
  avatarState: 'idle' as AvatarState,
  elapsedSeconds: 0,
  isInterviewActive: false,
  evaluation: null,
};

export const useInterviewStore = create<InterviewState>()(
  immer((set) => ({
    ...initialState,

    setResumeText: (text, fileName) =>
      set((s) => {
        s.resumeText = text;
        s.resumeFileName = fileName;
      }),

    setJobPostingText: (text, companyName, position) =>
      set((s) => {
        s.jobPostingText = text;
        s.jobCompanyName = companyName ?? null;
        s.jobPosition = position ?? null;
      }),

    setInterviewSetup: (setup) => {
      saveInterviewSetup(setup);
      set((s) => {
        s.interviewSetup = setup;
      });
    },

    addTranscript: (entry) =>
      set((s) => {
        s.transcript.push(entry);
      }),

    setAvatarState: (state) =>
      set((s) => {
        s.avatarState = state;
      }),

    incrementTimer: () =>
      set((s) => {
        s.elapsedSeconds += 1;
      }),

    setInterviewActive: (active) =>
      set((s) => {
        s.isInterviewActive = active;
      }),

    setEvaluation: (evaluation) =>
      set((s) => {
        s.evaluation = evaluation;
      }),

    hydrateFromSession: () => {
      const saved = loadInterviewSetup();
      if (saved) {
        set((s) => {
          s.interviewSetup = saved;
        });
      }
    },

    reset: () => {
      saveInterviewSetup(null);
      set(() => ({
        ...initialState,
        interviewSetup: null,
      }));
    },
  }))
);

// Transcript를 대화 기록 문자열로 변환
export function formatTranscript(
  transcript: TranscriptEntry[],
  interviewerName: string
): string {
  return transcript
    .map((entry) => {
      const speaker =
        entry.speaker === 'interviewer'
          ? `면접관(${interviewerName})`
          : '지원자';
      return `${speaker}: ${entry.text}`;
    })
    .join('\n');
}
