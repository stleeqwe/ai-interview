export type TraceId = string;
export type SpanId = string;
export type PipelineStage = 'stage0' | 'grounding' | 'stage1' | 'chat_init' | 'stage2' | 'stage3';

export interface LLMSpan {
  id: SpanId;
  traceId: TraceId;
  stage: PipelineStage;
  model: string;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  systemPrompt: string;
  userMessage: string;
  rawResponse: string;
  rawResponsePreview: string;
  parsedSuccessfully: boolean;
  inputTokens: number;
  outputTokens: number;
  stopReason: string;
}

export interface RealtimeEventEntry {
  id?: number;
  traceId: TraceId;
  seq: number;
  timestamp: string;
  perfTimestamp: number;
  direction: 'inbound' | 'outbound';
  eventType: string;
  payload: Record<string, unknown> | null;
  aggregated?: { count: number; totalBytes: number; windowMs: number };
}

export type ErrorSeverity = 'fatal' | 'error' | 'warning' | 'info';
export type ErrorCategory =
  | 'gemini.api'
  | 'gemini.chat'
  | 'app.json_parse'
  | 'app.unknown';

export interface StructuredError {
  id: string;
  traceId: TraceId;
  timestamp: string;
  stage: PipelineStage;
  category: ErrorCategory;
  severity: ErrorSeverity;
  message: string;
  code?: string;
  context: Record<string, unknown>;
}

export interface SessionConfig {
  traceId: TraceId;
  timestamp: string;
  model: string;
  promptCharCount: number;
}

export interface TimelineEvent {
  seq: number;
  traceId: TraceId;
  timestamp: string;
  stage: PipelineStage;
  event: string;
  durationMs?: number;
  metadata?: Record<string, unknown>;
}

export interface PipelineLog {
  traceId: TraceId;
  startedAt: string;
  completedAt?: string;
  llmSpanIds: string[];
  sessionConfig: SessionConfig | null;
  errorIds: string[];
  timeline: TimelineEvent[];
}
