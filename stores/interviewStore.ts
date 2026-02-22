import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { InterviewSetupJSON } from '@/lib/schemas/interviewSetup';
import type { EvaluationJSON } from '@/lib/schemas/evaluation';
import type { GroundingReport } from '@/lib/types/grounding';
import { STORAGE_KEYS } from '@/lib/constants';

export interface AnalysisMetrics {
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  finishReason: string;
}

export interface ChatMetrics {
  durationMs: number;
  promptTokenCount: number;
  candidatesTokenCount: number;
  model: string;
  timestamp: string;
}

export interface EvaluationMetrics {
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  finishReason: string;
  model: string;
  timestamp: string;
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
  analysisMetrics: AnalysisMetrics | null;

  // 화면 3: 면접 진행
  transcript: TranscriptEntry[];
  avatarState: AvatarState;
  elapsedSeconds: number;
  isInterviewActive: boolean;
  talkingHeadRef: TalkingHeadInstance | null;

  // 화면 4: 평가
  evaluation: EvaluationJSON | null;

  // 모니터링 메트릭
  chatMetrics: ChatMetrics | null;
  evaluationMetrics: EvaluationMetrics | null;

  // 액션
  setResumeText: (text: string, fileName: string) => void;
  setJobPostingText: (text: string, companyName?: string, position?: string) => void;
  setInterviewSetup: (setup: InterviewSetupJSON) => void;
  setGroundingReport: (report: GroundingReport) => void;
  setAnalysisMetrics: (metrics: AnalysisMetrics) => void;
  setChatMetrics: (metrics: ChatMetrics) => void;
  setEvaluationMetrics: (metrics: EvaluationMetrics) => void;
  addTranscript: (entry: TranscriptEntry) => void;
  setAvatarState: (state: AvatarState) => void;
  incrementTimer: () => void;
  setInterviewActive: (active: boolean) => void;
  setTalkingHeadRef: (ref: TalkingHeadInstance | null) => void;
  setEvaluation: (evaluation: EvaluationJSON | null) => void;
  hydrateFromSession: () => void;
  resetForNewInterview: () => void;
  reset: () => void;
}


function loadFromStorage<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = sessionStorage.getItem(key);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

function saveToStorage(key: string, value: unknown) {
  if (typeof window === 'undefined') return;
  try {
    if (value !== null && value !== undefined) {
      sessionStorage.setItem(key, JSON.stringify(value));
    } else {
      sessionStorage.removeItem(key);
    }
  } catch { /* sessionStorage 용량 초과 등 무시 */ }
}

function loadInterviewSetup(): InterviewSetupJSON | null {
  return loadFromStorage<InterviewSetupJSON>(STORAGE_KEYS.SESSION);
}

function saveInterviewSetup(setup: InterviewSetupJSON | null) {
  saveToStorage(STORAGE_KEYS.SESSION, setup);
}

const initialState = {
  resumeText: null,
  resumeFileName: null,
  jobPostingText: null,
  jobCompanyName: null,
  jobPosition: null,
  interviewSetup: null as InterviewSetupJSON | null,
  groundingReport: null as GroundingReport | null,
  analysisMetrics: null as AnalysisMetrics | null,
  chatMetrics: null as ChatMetrics | null,
  evaluationMetrics: null as EvaluationMetrics | null,
  transcript: [],
  avatarState: 'idle' as AvatarState,
  elapsedSeconds: 0,
  isInterviewActive: false,
  talkingHeadRef: null as TalkingHeadInstance | null,
  evaluation: null,
};

export const useInterviewStore = create<InterviewState>()(
  subscribeWithSelector(immer((set) => ({
    ...initialState,

    setResumeText: (text, fileName) => {
      saveToStorage(STORAGE_KEYS.RESUME_TEXT, text);
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
      saveToStorage(STORAGE_KEYS.GROUNDING_REPORT, report);
      set((s) => {
        s.groundingReport = report;
      });
    },

    setAnalysisMetrics: (metrics) => {
      saveToStorage(STORAGE_KEYS.ANALYSIS_METRICS, metrics);
      set((s) => {
        s.analysisMetrics = metrics;
      });
    },

    setChatMetrics: (metrics) => {
      saveToStorage(STORAGE_KEYS.CHAT_METRICS, metrics);
      set((s) => {
        s.chatMetrics = metrics;
      });
    },

    setEvaluationMetrics: (metrics) => {
      saveToStorage(STORAGE_KEYS.EVALUATION_METRICS, metrics);
      set((s) => {
        s.evaluationMetrics = metrics;
      });
    },

    addTranscript: (entry) =>
      set((s) => {
        s.transcript.push(entry);
        saveToStorage(STORAGE_KEYS.TRANSCRIPT, s.transcript);
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

    setTalkingHeadRef: (ref) =>
      set((s) => {
        // TalkingHead 인스턴스는 외부 객체이므로 immer draft 변환 우회
        (s as unknown as { talkingHeadRef: TalkingHeadInstance | null }).talkingHeadRef = ref;
      }),

    setEvaluation: (evaluation) => {
      saveToStorage(STORAGE_KEYS.EVALUATION, evaluation);
      set((s) => {
        s.evaluation = evaluation;
      });
    },

    hydrateFromSession: () => {
      const savedSetup = loadInterviewSetup();
      const savedTranscript = loadFromStorage<TranscriptEntry[]>(STORAGE_KEYS.TRANSCRIPT);
      const savedEvaluation = loadFromStorage<EvaluationJSON>(STORAGE_KEYS.EVALUATION);
      const savedResumeText = loadFromStorage<string>(STORAGE_KEYS.RESUME_TEXT);
      const savedGrounding = loadFromStorage<GroundingReport>(STORAGE_KEYS.GROUNDING_REPORT);
      const savedAnalysisMetrics = loadFromStorage<AnalysisMetrics>(STORAGE_KEYS.ANALYSIS_METRICS);
      const savedChatMetrics = loadFromStorage<ChatMetrics>(STORAGE_KEYS.CHAT_METRICS);
      const savedEvaluationMetrics = loadFromStorage<EvaluationMetrics>(STORAGE_KEYS.EVALUATION_METRICS);
      set((s) => {
        if (savedSetup) s.interviewSetup = savedSetup;
        if (savedTranscript?.length) s.transcript = savedTranscript;
        if (savedEvaluation) s.evaluation = savedEvaluation;
        if (savedResumeText) s.resumeText = savedResumeText;
        if (savedGrounding) s.groundingReport = savedGrounding;
        if (savedAnalysisMetrics) s.analysisMetrics = savedAnalysisMetrics;
        if (savedChatMetrics) s.chatMetrics = savedChatMetrics;
        if (savedEvaluationMetrics) s.evaluationMetrics = savedEvaluationMetrics;
      });
    },

    resetForNewInterview: () => {
      // 면접 진행/평가 데이터만 초기화 (시나리오 설정은 유지)
      saveToStorage(STORAGE_KEYS.TRANSCRIPT, null);
      saveToStorage(STORAGE_KEYS.EVALUATION, null);
      saveToStorage(STORAGE_KEYS.CHAT_METRICS, null);
      saveToStorage(STORAGE_KEYS.EVALUATION_METRICS, null);
      set((s) => {
        s.transcript = [];
        s.evaluation = null;
        s.elapsedSeconds = 0;
        s.isInterviewActive = false;
        s.avatarState = 'idle';
        s.chatMetrics = null;
        s.evaluationMetrics = null;
      });
    },

    reset: () => {
      saveInterviewSetup(null);
      saveToStorage(STORAGE_KEYS.TRANSCRIPT, null);
      saveToStorage(STORAGE_KEYS.EVALUATION, null);
      saveToStorage(STORAGE_KEYS.RESUME_TEXT, null);
      saveToStorage(STORAGE_KEYS.GROUNDING_REPORT, null);
      saveToStorage(STORAGE_KEYS.ANALYSIS_METRICS, null);
      saveToStorage(STORAGE_KEYS.CHAT_METRICS, null);
      saveToStorage(STORAGE_KEYS.EVALUATION_METRICS, null);
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
