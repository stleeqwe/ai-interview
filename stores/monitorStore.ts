import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { generateId, nowISO, truncate } from '@/lib/monitoring/helpers';
import { monitorDB } from '@/lib/monitoring/db';
import type {
  TraceId,
  PipelineStage,
  LLMSpan,
  RealtimeEventEntry,
  StructuredError,
  SessionConfig,
  TimelineEvent,
  PipelineLog,
  ErrorSeverity,
  ErrorCategory,
} from '@/lib/types/monitoring';

const RING_BUFFER_MAX = 1000;

interface MonitorState {
  currentTraceId: TraceId | null;
  pipelineLog: PipelineLog | null;
  llmSpans: LLMSpan[];
  realtimeEvents: RealtimeEventEntry[];
  errors: StructuredError[];
  _seq: number;

  // Historical
  historicalLogs: PipelineLog[];
  selectedTraceId: TraceId | null;
  historicalPipelineLog: PipelineLog | null;
  historicalSpans: LLMSpan[];
  historicalErrors: StructuredError[];
  historicalEvents: RealtimeEventEntry[];

  // Actions
  startPipeline: () => TraceId;
  addLLMSpan: (span: Omit<LLMSpan, 'id' | 'rawResponsePreview'>) => void;
  addTimelineEvent: (
    stage: PipelineStage,
    event: string,
    durationMs?: number,
    metadata?: Record<string, unknown>,
  ) => void;
  addRealtimeEvent: (
    direction: 'inbound' | 'outbound',
    eventType: string,
    payload: Record<string, unknown> | null,
    byteSize?: number,
  ) => void;
  addError: (params: {
    stage: PipelineStage;
    category: ErrorCategory;
    severity: ErrorSeverity;
    message: string;
    code?: string;
    context?: Record<string, unknown>;
  }) => void;
  setSessionConfig: (config: Omit<SessionConfig, 'traceId' | 'timestamp'>) => void;
  completePipeline: () => void;
  flushToIndexedDB: () => Promise<void>;
  loadHistoricalLogs: () => Promise<void>;
  selectHistoricalTrace: (traceId: TraceId) => Promise<void>;
  clearHistoricalSelection: () => void;
}

export const useMonitorStore = create<MonitorState>()(
  immer((set, get) => ({
    currentTraceId: null,
    pipelineLog: null,
    llmSpans: [],
    realtimeEvents: [],
    errors: [],
    _seq: 0,

    historicalLogs: [],
    selectedTraceId: null,
    historicalPipelineLog: null,
    historicalSpans: [],
    historicalErrors: [],
    historicalEvents: [],

    startPipeline: () => {
      const traceId = generateId();
      const now = nowISO();
      set((s) => {
        s.currentTraceId = traceId;
        s.llmSpans = [];
        s.realtimeEvents = [];
        s.errors = [];
        s._seq = 0;
        s.pipelineLog = {
          traceId,
          startedAt: now,
          llmSpanIds: [],
          sessionConfig: null,
          errorIds: [],
          timeline: [],
        };
      });
      return traceId;
    },

    addLLMSpan: (span) => {
      const id = generateId();
      set((s) => {
        const fullSpan: LLMSpan = {
          ...span,
          id,
          traceId: s.currentTraceId ?? span.traceId,
          rawResponsePreview: truncate(span.rawResponse),
        };
        s.llmSpans.push(fullSpan);
        if (s.pipelineLog) {
          s.pipelineLog.llmSpanIds.push(id);
        }
      });
    },

    addTimelineEvent: (stage, event, durationMs, metadata) => {
      set((s) => {
        const seq = s._seq++;
        const te: TimelineEvent = {
          seq,
          traceId: s.currentTraceId ?? '',
          timestamp: nowISO(),
          stage,
          event,
          durationMs,
          metadata,
        };
        if (s.pipelineLog) {
          s.pipelineLog.timeline.push(te);
        }
      });
    },

    addRealtimeEvent: (direction, eventType, payload) => {
      set((s) => {
        if (!s.currentTraceId) return;

        const seq = s._seq++;
        const entry: RealtimeEventEntry = {
          traceId: s.currentTraceId,
          seq,
          timestamp: nowISO(),
          perfTimestamp: performance.now(),
          direction,
          eventType,
          payload,
        };
        s.realtimeEvents.push(entry);
        if (s.realtimeEvents.length > RING_BUFFER_MAX) {
          s.realtimeEvents.shift();
        }
      });
    },

    addError: ({ stage, category, severity, message, code, context }) => {
      const id = generateId();
      set((s) => {
        const err: StructuredError = {
          id,
          traceId: s.currentTraceId ?? '',
          timestamp: nowISO(),
          stage,
          category,
          severity,
          message,
          code,
          context: context ?? {},
        };
        s.errors.push(err);
        if (s.pipelineLog) {
          s.pipelineLog.errorIds.push(id);
        }
      });
    },

    setSessionConfig: (config) => {
      set((s) => {
        if (s.pipelineLog) {
          s.pipelineLog.sessionConfig = {
            ...config,
            traceId: s.currentTraceId ?? '',
            timestamp: nowISO(),
          };
        }
      });
    },

    completePipeline: () => {
      set((s) => {
        if (s.pipelineLog) {
          s.pipelineLog.completedAt = nowISO();
        }
      });
    },

    flushToIndexedDB: async () => {
      const state = get();
      if (!state.pipelineLog) return;
      const traceId = state.currentTraceId;

      try {
        await monitorDB.transaction(
          'rw',
          [monitorDB.pipelineLogs, monitorDB.llmSpans, monitorDB.realtimeEvents, monitorDB.errors],
          async () => {
            await monitorDB.pipelineLogs.put(state.pipelineLog!);

            // 이전 flush 데이터 삭제 후 재삽입 (이중 flush 시 중복 방지)
            if (traceId) {
              await monitorDB.llmSpans.where('traceId').equals(traceId).delete();
              await monitorDB.realtimeEvents.where('traceId').equals(traceId).delete();
              await monitorDB.errors.where('traceId').equals(traceId).delete();
            }
            if (state.llmSpans.length > 0) {
              await monitorDB.llmSpans.bulkPut(state.llmSpans);
            }
            if (state.realtimeEvents.length > 0) {
              const events = state.realtimeEvents.map(({ id: _id, ...rest }) => rest);
              await monitorDB.realtimeEvents.bulkAdd(events as RealtimeEventEntry[]);
            }
            if (state.errors.length > 0) {
              await monitorDB.errors.bulkPut(state.errors);
            }
          },
        );
        console.log(`[MonitorStore] IndexedDB flush 완료 (trace=${traceId})`);
      } catch (err) {
        console.warn('[MonitorStore] IndexedDB flush 실패:', err);
      }
    },

    loadHistoricalLogs: async () => {
      try {
        const logs = await monitorDB.pipelineLogs
          .orderBy('startedAt')
          .reverse()
          .toArray();
        set((s) => {
          s.historicalLogs = logs;
        });
      } catch (err) {
        console.warn('[MonitorStore] 과거 로그 로드 실패:', err);
      }
    },

    selectHistoricalTrace: async (traceId: TraceId) => {
      try {
        const [log, spans, errors, events] = await Promise.all([
          monitorDB.pipelineLogs.get(traceId),
          monitorDB.llmSpans.where('traceId').equals(traceId).toArray(),
          monitorDB.errors.where('traceId').equals(traceId).toArray(),
          monitorDB.realtimeEvents.where('traceId').equals(traceId).toArray(),
        ]);
        set((s) => {
          s.selectedTraceId = traceId;
          s.historicalPipelineLog = log ?? null;
          s.historicalSpans = spans;
          s.historicalErrors = errors;
          s.historicalEvents = events;
        });
      } catch (err) {
        console.warn('[MonitorStore] 과거 세션 로드 실패:', err);
      }
    },

    clearHistoricalSelection: () => {
      set((s) => {
        s.selectedTraceId = null;
        s.historicalPipelineLog = null;
        s.historicalSpans = [];
        s.historicalErrors = [];
        s.historicalEvents = [];
      });
    },
  })),
);
