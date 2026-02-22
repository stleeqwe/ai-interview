export const GEMINI_MODEL = 'gemini-3-flash-preview';
export const INTERVIEW_END_TOKEN = '[INTERVIEW_END]';

export const INTERVIEW_MAX_SECONDS = 10 * 60;
export const INTERVIEW_WARNING_SECONDS = 8 * 60;

export const AVATAR_SPEAKING_DURATION_MS = 2000;
export const INTERVIEW_END_DELAY_MS = 2000;

export const LOADING_STEP_INTERVAL_MS = 800;
export const LOADING_PROGRESS_INTERVAL_MS = 60;

export const MIN_TEXT_LENGTH = 50;
export const MAX_RESUME_FILE_SIZE = 5 * 1024 * 1024;

export const STORAGE_KEYS = {
  SESSION: 'ai-interview-setup',
  TRANSCRIPT: 'ai-interview-transcript',
  EVALUATION: 'ai-interview-evaluation',
  RESUME_TEXT: 'ai-interview-resume-text',
  GROUNDING_REPORT: 'ai-interview-grounding-report',
  ANALYSIS_METRICS: 'ai-interview-analysis-metrics',
  CHAT_METRICS: 'ai-interview-chat-metrics',
  EVALUATION_METRICS: 'ai-interview-evaluation-metrics',
} as const;
