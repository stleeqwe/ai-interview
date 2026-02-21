import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { InterviewSetupJSON } from '@/lib/schemas/interviewSetup';
import type { EvaluationJSON } from '@/lib/schemas/evaluation';
import type { GroundingReport } from '@/lib/types/grounding';

export interface ClaudeMetrics {
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  stopReason: string;
}

export interface TranscriptEntry {
  speaker: 'interviewer' | 'candidate';
  text: string;
  timestamp: number;
}

type AvatarState = 'idle' | 'speaking' | 'listening';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TalkingHeadInstance = any;

interface InterviewState {
  // 화면 1: 업로드
  resumeText: string | null;
  resumeFileName: string | null;
  jobPostingText: string | null;
  jobCompanyName: string | null;
  jobPosition: string | null;

  // 화면 2→3: 분석 결과
  interviewSetup: InterviewSetupJSON | null;
  groundingReport: GroundingReport | null;
  claudeMetrics: ClaudeMetrics | null;

  // 화면 3: 면접 진행
  transcript: TranscriptEntry[];
  avatarState: AvatarState;
  elapsedSeconds: number;
  isInterviewActive: boolean;
  audioElement: HTMLAudioElement | null;
  talkingHeadRef: TalkingHeadInstance | null;

  // 화면 4: 평가
  evaluation: EvaluationJSON | null;

  // 액션
  setResumeText: (text: string, fileName: string) => void;
  setJobPostingText: (text: string, companyName?: string, position?: string) => void;
  setInterviewSetup: (setup: InterviewSetupJSON) => void;
  setGroundingReport: (report: GroundingReport) => void;
  setClaudeMetrics: (metrics: ClaudeMetrics) => void;
  addTranscript: (entry: TranscriptEntry) => void;
  setAvatarState: (state: AvatarState) => void;
  incrementTimer: () => void;
  setInterviewActive: (active: boolean) => void;
  setAudioElement: (el: HTMLAudioElement | null) => void;
  setTalkingHeadRef: (ref: TalkingHeadInstance | null) => void;
  setEvaluation: (evaluation: EvaluationJSON | null) => void;
  hydrateFromSession: () => void;
  reset: () => void;
}

const SESSION_STORAGE_KEY = 'ai-interview-setup';
const TRANSCRIPT_STORAGE_KEY = 'ai-interview-transcript';
const EVALUATION_STORAGE_KEY = 'ai-interview-evaluation';
const RESUME_TEXT_STORAGE_KEY = 'ai-interview-resume-text';
const GROUNDING_REPORT_KEY = 'ai-interview-grounding-report';
const CLAUDE_METRICS_KEY = 'ai-interview-claude-metrics';

function loadFromStorage<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

function saveToStorage(key: string, value: unknown) {
  if (typeof window === 'undefined') return;
  try {
    if (value !== null && value !== undefined) {
      localStorage.setItem(key, JSON.stringify(value));
    } else {
      localStorage.removeItem(key);
    }
  } catch { /* localStorage 용량 초과 등 무시 */ }
}

function loadInterviewSetup(): InterviewSetupJSON | null {
  return loadFromStorage<InterviewSetupJSON>(SESSION_STORAGE_KEY);
}

function saveInterviewSetup(setup: InterviewSetupJSON | null) {
  saveToStorage(SESSION_STORAGE_KEY, setup);
}

const initialState = {
  resumeText: null,
  resumeFileName: null,
  jobPostingText: null,
  jobCompanyName: null,
  jobPosition: null,
  interviewSetup: null as InterviewSetupJSON | null,
  groundingReport: null as GroundingReport | null,
  claudeMetrics: null as ClaudeMetrics | null,
  transcript: [],
  avatarState: 'idle' as AvatarState,
  elapsedSeconds: 0,
  isInterviewActive: false,
  audioElement: null as HTMLAudioElement | null,
  talkingHeadRef: null as TalkingHeadInstance | null,
  evaluation: null,
};

export const useInterviewStore = create<InterviewState>()(
  subscribeWithSelector(immer((set) => ({
    ...initialState,

    setResumeText: (text, fileName) => {
      saveToStorage(RESUME_TEXT_STORAGE_KEY, text);
      set((s) => {
        s.resumeText = text;
        s.resumeFileName = fileName;
      });
    },

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

    setGroundingReport: (report) => {
      saveToStorage(GROUNDING_REPORT_KEY, report);
      set((s) => {
        s.groundingReport = report;
      });
    },

    setClaudeMetrics: (metrics) => {
      saveToStorage(CLAUDE_METRICS_KEY, metrics);
      set((s) => {
        s.claudeMetrics = metrics;
      });
    },

    addTranscript: (entry) =>
      set((s) => {
        s.transcript.push(entry);
        saveToStorage(TRANSCRIPT_STORAGE_KEY, s.transcript);
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

    setAudioElement: (el) =>
      set((s) => {
        // HTMLAudioElement은 DOM 객체이므로 immer draft 변환 우회
        (s as unknown as { audioElement: HTMLAudioElement | null }).audioElement = el;
      }),

    setTalkingHeadRef: (ref) =>
      set((s) => {
        // TalkingHead 인스턴스는 외부 객체이므로 immer draft 변환 우회
        (s as unknown as { talkingHeadRef: TalkingHeadInstance | null }).talkingHeadRef = ref;
      }),

    setEvaluation: (evaluation) => {
      saveToStorage(EVALUATION_STORAGE_KEY, evaluation);
      set((s) => {
        s.evaluation = evaluation;
      });
    },

    hydrateFromSession: () => {
      const savedSetup = loadInterviewSetup();
      const savedTranscript = loadFromStorage<TranscriptEntry[]>(TRANSCRIPT_STORAGE_KEY);
      const savedEvaluation = loadFromStorage<EvaluationJSON>(EVALUATION_STORAGE_KEY);
      const savedResumeText = loadFromStorage<string>(RESUME_TEXT_STORAGE_KEY);
      const savedGrounding = loadFromStorage<GroundingReport>(GROUNDING_REPORT_KEY);
      const savedClaudeMetrics = loadFromStorage<ClaudeMetrics>(CLAUDE_METRICS_KEY);
      set((s) => {
        if (savedSetup) s.interviewSetup = savedSetup;
        if (savedTranscript?.length) s.transcript = savedTranscript;
        if (savedEvaluation) s.evaluation = savedEvaluation;
        if (savedResumeText) s.resumeText = savedResumeText;
        if (savedGrounding) s.groundingReport = savedGrounding;
        if (savedClaudeMetrics) s.claudeMetrics = savedClaudeMetrics;
      });
    },

    reset: () => {
      saveInterviewSetup(null);
      saveToStorage(TRANSCRIPT_STORAGE_KEY, null);
      saveToStorage(EVALUATION_STORAGE_KEY, null);
      saveToStorage(RESUME_TEXT_STORAGE_KEY, null);
      saveToStorage(GROUNDING_REPORT_KEY, null);
      saveToStorage(CLAUDE_METRICS_KEY, null);
      set(() => ({
        ...initialState,
      }));
    },
  })))
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
