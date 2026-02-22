import { useMonitorStore } from '@/stores/monitorStore';
import type { PipelineStage } from '@/lib/types/monitoring';

export function recordLLMSpan(data: {
  stage: PipelineStage;
  model: string;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  systemPrompt: string;
  userMessage: string;
  rawResponse: string;
  inputTokens: number;
  outputTokens: number;
  stopReason: string;
}): void {
  const monitor = useMonitorStore.getState();
  monitor.addLLMSpan({
    traceId: monitor.currentTraceId ?? '',
    ...data,
    parsedSuccessfully: true,
  });
  monitor.addTimelineEvent(data.stage, `${data.stage}.completed`, data.durationMs);
}
