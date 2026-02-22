import Dexie, { type EntityTable } from 'dexie';
import type {
  LLMSpan,
  RealtimeEventEntry,
  StructuredError,
  PipelineLog,
} from '@/lib/types/monitoring';

const DB_NAME = 'ai-interview-monitor';
const TTL_DAYS = 7;
const MAX_SESSIONS = 5;

class MonitorDB extends Dexie {
  llmSpans!: EntityTable<LLMSpan, 'id'>;
  realtimeEvents!: EntityTable<RealtimeEventEntry, 'id'>;
  errors!: EntityTable<StructuredError, 'id'>;
  pipelineLogs!: EntityTable<PipelineLog, 'traceId'>;

  constructor() {
    super(DB_NAME);
    this.version(1).stores({
      llmSpans: 'id, traceId, stage',
      realtimeEvents: '++id, traceId, seq',
      errors: 'id, traceId, stage',
      pipelineLogs: 'traceId, startedAt',
    });
    // v2: Gemini 전환 — 스키마 변경 없음, 데이터 호환
    this.version(2).stores({
      llmSpans: 'id, traceId, stage',
      realtimeEvents: '++id, traceId, seq',
      errors: 'id, traceId, stage',
      pipelineLogs: 'traceId, startedAt',
    });
  }
}

export const monitorDB = new MonitorDB();

/**
 * TTL (7일 초과) + LRU (최근 5세션 초과) 기반 자동 정리
 */
export async function cleanupOldSessions(): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

    // 1. TTL: 7일 초과 세션 삭제
    const allLogs = await monitorDB.pipelineLogs.toArray();
    const expiredTraceIds = allLogs
      .filter((log) => log.startedAt < cutoff)
      .map((log) => log.traceId);

    // 2. LRU: 최근 5세션만 유지
    const recentLogs = allLogs
      .filter((log) => !expiredTraceIds.includes(log.traceId))
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt));

    const lruTraceIds = recentLogs.slice(MAX_SESSIONS).map((log) => log.traceId);

    const toDelete = [...new Set([...expiredTraceIds, ...lruTraceIds])];
    if (toDelete.length === 0) return;

    await monitorDB.transaction(
      'rw',
      [monitorDB.pipelineLogs, monitorDB.llmSpans, monitorDB.realtimeEvents, monitorDB.errors],
      async () => {
        await monitorDB.pipelineLogs.bulkDelete(toDelete);
        for (const traceId of toDelete) {
          await monitorDB.llmSpans.where('traceId').equals(traceId).delete();
          await monitorDB.realtimeEvents.where('traceId').equals(traceId).delete();
          await monitorDB.errors.where('traceId').equals(traceId).delete();
        }
      },
    );

    if (toDelete.length > 0) {
      console.log(`[MonitorDB] ${toDelete.length}개 세션 정리 완료`);
    }
  } catch (err) {
    console.warn('[MonitorDB] cleanup 실패:', err);
  }
}
