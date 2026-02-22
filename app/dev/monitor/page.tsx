'use client';

import { useState, useEffect } from 'react';
import { useInterviewStore } from '@/stores/interviewStore';
import { useMonitorStore } from '@/stores/monitorStore';
import type { LLMSpan, StructuredError, TimelineEvent } from '@/lib/types/monitoring';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Search,
  Clock,
  CheckCircle2,
  Brain,
  Zap,
  FileCheck,
  AlertTriangle,
  Copy,
  ChevronDown,
  ChevronRight,
  List,
  Timer,
  MessageSquare,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

// ─── Helpers ─────────────────────────────────────────────

function MetricBox({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-4 text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function StageCard({
  step,
  color,
  icon,
  title,
  duration,
  children,
  available,
}: {
  step: number;
  color: string;
  icon: React.ReactNode;
  title: string;
  duration?: number | null;
  children: React.ReactNode;
  available: boolean;
}) {
  return (
    <Card className={!available ? 'opacity-50' : ''}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <span
            className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white ${color}`}
          >
            {step}
          </span>
          {icon}
          {title}
          {duration != null && (
            <span className="ml-auto text-sm font-normal text-muted-foreground">
              <Clock className="mr-1 inline h-3 w-3" />
              {(duration / 1000).toFixed(1)}s
            </span>
          )}
          {!available && (
            <Badge variant="outline" className="ml-auto text-xs">
              데이터 없음
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function PipelineArrow({ label }: { label: string }) {
  return (
    <div className="flex justify-center">
      <div className="flex flex-col items-center text-muted-foreground">
        <div className="h-4 w-px bg-border" />
        <span className="text-xs">{label}</span>
        <div className="h-4 w-px bg-border" />
        <span className="text-lg">&darr;</span>
      </div>
    </div>
  );
}

function formatDuration(ms: number): string {
  const sec = Math.floor(ms / 1000);
  const min = Math.floor(sec / 60);
  const s = sec % 60;
  return min > 0 ? `${min}분 ${s}초` : `${s}초`;
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('ko-KR', { hour12: false, fractionalSecondDigits: 3 });
  } catch {
    return iso;
  }
}

const STAGE_COLORS: Record<string, string> = {
  stage0: 'bg-purple-600',
  grounding: 'bg-blue-600',
  stage1: 'bg-orange-600',
  chat_init: 'bg-green-600',
  stage2: 'bg-teal-600',
  stage3: 'bg-red-600',
};

const SEVERITY_COLORS: Record<string, string> = {
  fatal: 'bg-red-600 text-white',
  error: 'bg-orange-500 text-white',
  warning: 'bg-yellow-500 text-black',
  info: 'bg-blue-500 text-white',
};

// ─── Copyable Pre Block ────────────────────────────────

function CopyableBlock({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={handleCopy}>
          <Copy className="mr-1 h-3 w-3" />
          {copied ? '복사됨' : '복사'}
        </Button>
      </div>
      <pre className="max-h-60 overflow-auto rounded border bg-muted/50 p-3 text-xs leading-relaxed whitespace-pre-wrap break-all">
        {text || '(비어있음)'}
      </pre>
    </div>
  );
}

// ─── LLM Span Card ─────────────────────────────────────

function LLMSpanCard({ span }: { span: LLMSpan }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card>
      <CardHeader className="pb-2">
        <button
          className="flex w-full items-center gap-2 text-left"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <Badge className={`${STAGE_COLORS[span.stage]} text-xs`}>{span.stage}</Badge>
          <span className="text-sm font-medium">{span.model}</span>
          <span className="text-xs text-muted-foreground">
            {(span.durationMs / 1000).toFixed(1)}s
          </span>
          <span className="text-xs text-muted-foreground">
            in={span.inputTokens.toLocaleString()} out={span.outputTokens.toLocaleString()}
          </span>
          {!span.parsedSuccessfully && (
            <Badge variant="destructive" className="ml-auto text-xs">파싱 실패</Badge>
          )}
        </button>
      </CardHeader>
      {expanded && (
        <CardContent className="space-y-3 pt-0">
          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="rounded border p-1.5">
              <p className="text-[10px] text-muted-foreground">시작</p>
              <p className="text-xs font-mono">{formatTime(span.startedAt)}</p>
            </div>
            <div className="rounded border p-1.5">
              <p className="text-[10px] text-muted-foreground">종료</p>
              <p className="text-xs font-mono">{formatTime(span.endedAt)}</p>
            </div>
            <div className="rounded border p-1.5">
              <p className="text-[10px] text-muted-foreground">Stop</p>
              <p className="text-xs font-mono">{span.stopReason}</p>
            </div>
            <div className="rounded border p-1.5">
              <p className="text-[10px] text-muted-foreground">소요</p>
              <p className="text-xs font-mono">{(span.durationMs / 1000).toFixed(2)}s</p>
            </div>
          </div>
          <Separator />
          <CopyableBlock label="System Prompt" text={span.systemPrompt} />
          {span.userMessage && <CopyableBlock label="User Message" text={span.userMessage} />}
          <CopyableBlock label="Raw Response" text={span.rawResponse} />
        </CardContent>
      )}
    </Card>
  );
}

// ─── Error Table ────────────────────────────────────────

function ErrorTable({ errors }: { errors: StructuredError[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (errors.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-green-500" />
          <p className="text-sm text-muted-foreground">에러 없음</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="rounded border">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b bg-muted/30">
            <th className="px-3 py-2 text-left font-medium">시각</th>
            <th className="px-3 py-2 text-left font-medium">Stage</th>
            <th className="px-3 py-2 text-left font-medium">Category</th>
            <th className="px-3 py-2 text-left font-medium">Severity</th>
            <th className="px-3 py-2 text-left font-medium">Message</th>
          </tr>
        </thead>
        <tbody>
          {errors.map((err) => (
            <tr key={err.id} className="group">
              <td colSpan={5} className="p-0">
                <button
                  className="flex w-full items-center border-b px-3 py-2 text-left hover:bg-muted/20"
                  onClick={() => setExpandedId(expandedId === err.id ? null : err.id)}
                >
                  <span className="w-24 shrink-0 font-mono">{formatTime(err.timestamp)}</span>
                  <Badge className={`${STAGE_COLORS[err.stage]} mx-1 text-[10px]`}>{err.stage}</Badge>
                  <span className="w-32 shrink-0 font-mono text-[11px]">{err.category}</span>
                  <Badge className={`${SEVERITY_COLORS[err.severity]} mx-1 text-[10px]`}>
                    {err.severity}
                  </Badge>
                  <span className="flex-1 truncate">{err.message}</span>
                  {expandedId === err.id ? (
                    <ChevronDown className="ml-1 h-3 w-3 shrink-0" />
                  ) : (
                    <ChevronRight className="ml-1 h-3 w-3 shrink-0" />
                  )}
                </button>
                {expandedId === err.id && (
                  <div className="border-b bg-muted/10 px-3 py-2">
                    {err.code && (
                      <p className="mb-1 text-[11px]">
                        <span className="text-muted-foreground">Code: </span>
                        <span className="font-mono">{err.code}</span>
                      </p>
                    )}
                    <pre className="max-h-40 overflow-auto rounded bg-muted/50 p-2 text-[11px] whitespace-pre-wrap break-all">
                      {JSON.stringify(err.context, null, 2)}
                    </pre>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Timeline View ──────────────────────────────────────

function TimelineView({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Timer className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">타임라인 이벤트 없음</p>
        </CardContent>
      </Card>
    );
  }

  const sorted = [...events].sort((a, b) => a.seq - b.seq);

  return (
    <div className="space-y-0">
      {sorted.map((ev, i) => {
        const prevTs = i > 0 ? new Date(sorted[i - 1].timestamp).getTime() : null;
        const curTs = new Date(ev.timestamp).getTime();
        const gapMs = prevTs != null ? curTs - prevTs : null;

        return (
          <div key={ev.seq}>
            {gapMs != null && gapMs > 100 && (
              <div className="flex items-center gap-2 py-1 pl-8">
                <div className="h-4 border-l-2 border-dashed border-muted-foreground/30" />
                <span className="text-[10px] text-muted-foreground">
                  +{gapMs >= 1000 ? `${(gapMs / 1000).toFixed(1)}s` : `${gapMs}ms`}
                </span>
              </div>
            )}
            <div className="flex items-center gap-3 py-1.5">
              <span className="w-20 shrink-0 text-right text-[11px] font-mono text-muted-foreground">
                {formatTime(ev.timestamp)}
              </span>
              <span
                className={`h-3 w-3 shrink-0 rounded-full ${STAGE_COLORS[ev.stage]}`}
              />
              <Badge variant="outline" className="text-[10px]">{ev.stage}</Badge>
              <span className="text-sm font-medium">{ev.event}</span>
              {ev.durationMs != null && (
                <span className="text-xs text-muted-foreground">
                  ({(ev.durationMs / 1000).toFixed(1)}s)
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Historical Session Selector ─────────────────────────

function SessionSelector() {
  const historicalLogs = useMonitorStore((s) => s.historicalLogs);
  const selectedTraceId = useMonitorStore((s) => s.selectedTraceId);
  const loadHistoricalLogs = useMonitorStore((s) => s.loadHistoricalLogs);
  const selectHistoricalTrace = useMonitorStore((s) => s.selectHistoricalTrace);
  const clearHistoricalSelection = useMonitorStore((s) => s.clearHistoricalSelection);
  const currentTraceId = useMonitorStore((s) => s.currentTraceId);

  useEffect(() => {
    loadHistoricalLogs();
  }, [loadHistoricalLogs]);

  if (historicalLogs.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-muted-foreground">세션:</label>
      <select
        className="rounded border bg-background px-2 py-1 text-xs"
        value={selectedTraceId ?? ''}
        onChange={(e) => {
          const val = e.target.value;
          if (val) {
            selectHistoricalTrace(val);
          } else {
            clearHistoricalSelection();
          }
        }}
      >
        <option value="">현재 세션</option>
        {historicalLogs.map((log) => (
          <option key={log.traceId} value={log.traceId}>
            {new Date(log.startedAt).toLocaleString('ko-KR')}
            {log.traceId === currentTraceId ? ' (현재)' : ''}
            {log.completedAt ? ' \u2713' : ' ...'}
          </option>
        ))}
      </select>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────

export default function PipelineMonitorPage() {
  const groundingReport = useInterviewStore((s) => s.groundingReport);
  const analysisMetrics = useInterviewStore((s) => s.analysisMetrics);
  const interviewSetup = useInterviewStore((s) => s.interviewSetup);
  const evaluationMetrics = useInterviewStore((s) => s.evaluationMetrics);
  const evaluation = useInterviewStore((s) => s.evaluation);
  const transcript = useInterviewStore((s) => s.transcript);

  // Monitor store — current session
  const currentSpans = useMonitorStore((s) => s.llmSpans);
  const currentErrors = useMonitorStore((s) => s.errors);
  const pipelineLog = useMonitorStore((s) => s.pipelineLog);

  // Historical data
  const selectedTraceId = useMonitorStore((s) => s.selectedTraceId);
  const historicalPipelineLog = useMonitorStore((s) => s.historicalPipelineLog);
  const historicalSpans = useMonitorStore((s) => s.historicalSpans);
  const historicalErrors = useMonitorStore((s) => s.historicalErrors);

  // Choose current or historical data
  const activePipelineLog = selectedTraceId ? historicalPipelineLog : pipelineLog;
  const spans: LLMSpan[] = selectedTraceId ? historicalSpans : currentSpans;
  const errors: StructuredError[] = selectedTraceId ? historicalErrors : currentErrors;
  const timeline: TimelineEvent[] = activePipelineLog?.timeline ?? [];

  const hasAnyData =
    groundingReport ||
    analysisMetrics ||
    evaluationMetrics ||
    spans.length > 0 ||
    errors.length > 0;

  if (!hasAnyData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-background to-muted/30 px-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-12 text-center">
            <Search className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <h2 className="text-lg font-semibold">모니터링 데이터 없음</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              면접 파이프라인을 실행하면 Stage 0~3의 메트릭이 여기에 표시됩니다.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 전체 소요 시간 계산
  const totalDurationMs =
    (groundingReport?.durationMs ?? 0) +
    (analysisMetrics?.durationMs ?? 0) +
    (evaluationMetrics?.durationMs ?? 0);

  const stage01Tokens =
    (analysisMetrics?.inputTokens ?? 0) + (analysisMetrics?.outputTokens ?? 0);

  const stage3Tokens =
    (evaluationMetrics?.inputTokens ?? 0) + (evaluationMetrics?.outputTokens ?? 0);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 px-4 py-8">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Pipeline Monitor</h1>
            <p className="text-sm text-muted-foreground">
              전체 면접 파이프라인 (Stage 0 &rarr; 3) 모니터링
            </p>
          </div>
          <div className="flex items-center gap-3">
            <SessionSelector />
            <Badge variant="outline" className="text-xs">
              <Clock className="mr-1 h-3 w-3" />
              {new Date().toLocaleString('ko-KR')}
            </Badge>
          </div>
        </div>

        {/* 요약 메트릭 그리드 */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MetricBox
            label="전체 소요"
            value={totalDurationMs > 0 ? formatDuration(totalDurationMs) : '-'}
            sub="파이프라인 합계"
          />
          <MetricBox
            label="S0-1 토큰"
            value={stage01Tokens > 0 ? stage01Tokens.toLocaleString() : '-'}
            sub="Gemini 분석+시나리오"
          />
          <MetricBox
            label="S2 대화 턴"
            value={transcript.length > 0 ? transcript.length : '-'}
            sub="텍스트 채팅"
          />
          <MetricBox
            label="S3 토큰"
            value={stage3Tokens > 0 ? stage3Tokens.toLocaleString() : '-'}
            sub="Gemini 평가"
          />
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MetricBox
            label="대화 턴 수"
            value={transcript.length > 0 ? transcript.length : '-'}
            sub="전체 트랜스크립트"
          />
          <MetricBox
            label="에러 수"
            value={errors.length > 0 ? errors.length : '-'}
            sub="구조화 에러"
          />
          <MetricBox
            label="LLM Spans"
            value={spans.length > 0 ? spans.length : '-'}
            sub="API 호출"
          />
          <MetricBox
            label="평가 등급"
            value={evaluation?.overall_evaluation?.overall_grade ?? '-'}
            sub={evaluation?.overall_evaluation?.hire_recommendation ?? ''}
          />
        </div>

        {/* 6탭 */}
        <Tabs defaultValue="pipeline" className="space-y-4">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="pipeline">
              <Zap className="mr-1 h-3 w-3" />
              <span className="hidden sm:inline">파이프라인</span>
              <span className="sm:hidden">PL</span>
            </TabsTrigger>
            <TabsTrigger value="stage2">
              <MessageSquare className="mr-1 h-3 w-3" />
              <span className="hidden sm:inline">Stage 2</span>
              <span className="sm:hidden">S2</span>
            </TabsTrigger>
            <TabsTrigger value="stage3">
              <FileCheck className="mr-1 h-3 w-3" />
              <span className="hidden sm:inline">Stage 3</span>
              <span className="sm:hidden">S3</span>
            </TabsTrigger>
            <TabsTrigger value="llm-spans">
              <Brain className="mr-1 h-3 w-3" />
              <span className="hidden sm:inline">LLM Spans</span>
              <span className="sm:hidden">LLM</span>
            </TabsTrigger>
            <TabsTrigger value="errors">
              <AlertTriangle className="mr-1 h-3 w-3" />
              <span className="hidden sm:inline">Errors</span>
              <span className="sm:hidden">Err</span>
              {errors.length > 0 && (
                <Badge variant="destructive" className="ml-1 h-4 min-w-4 px-1 text-[10px]">
                  {errors.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="timeline">
              <List className="mr-1 h-3 w-3" />
              <span className="hidden sm:inline">Timeline</span>
              <span className="sm:hidden">TL</span>
            </TabsTrigger>
          </TabsList>

          {/* ═══ 파이프라인 탭 ═══ */}
          <TabsContent value="pipeline" className="space-y-3">
            <StageCard
              step={1}
              color="bg-purple-600"
              icon={<Brain className="h-4 w-4" />}
              title="Stage 0 — Gemini 사전분석"
              duration={analysisMetrics?.durationMs}
              available={!!analysisMetrics}
            >
              {analysisMetrics ? (
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded border p-2 text-center">
                    <p className="text-xs text-muted-foreground">Input</p>
                    <p className="text-sm font-semibold">{analysisMetrics.inputTokens.toLocaleString()}</p>
                  </div>
                  <div className="rounded border p-2 text-center">
                    <p className="text-xs text-muted-foreground">Output</p>
                    <p className="text-sm font-semibold">{analysisMetrics.outputTokens.toLocaleString()}</p>
                  </div>
                  <div className="rounded border p-2 text-center">
                    <p className="text-xs text-muted-foreground">Finish</p>
                    <p className="text-sm font-semibold">{analysisMetrics.finishReason}</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">데이터 없음</p>
              )}
            </StageCard>

            <PipelineArrow label="리서치 결과 주입" />

            <StageCard
              step={2}
              color="bg-blue-600"
              icon={<Search className="h-4 w-4" />}
              title="Grounding — Gemini 검색"
              duration={groundingReport?.durationMs}
              available={!!groundingReport}
            >
              {groundingReport ? (
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded border p-2 text-center">
                    <p className="text-xs text-muted-foreground">검색 쿼리</p>
                    <p className="text-sm font-semibold">{groundingReport.searchQueries.length}</p>
                  </div>
                  <div className="rounded border p-2 text-center">
                    <p className="text-xs text-muted-foreground">수집 소스</p>
                    <p className="text-sm font-semibold">{groundingReport.sources.length}</p>
                  </div>
                  <div className="rounded border p-2 text-center">
                    <p className="text-xs text-muted-foreground">리포트 길이</p>
                    <p className="text-sm font-semibold">{groundingReport.researchText.length.toLocaleString()}자</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">데이터 없음</p>
              )}
            </StageCard>

            <PipelineArrow label="시나리오 생성" />

            <StageCard
              step={3}
              color="bg-orange-600"
              icon={<Brain className="h-4 w-4" />}
              title="Stage 1 — Gemini 시나리오 생성"
              duration={analysisMetrics?.durationMs}
              available={!!interviewSetup}
            >
              {interviewSetup ? (
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded border p-2 text-center">
                    <p className="text-xs text-muted-foreground">회사</p>
                    <p className="text-sm font-semibold">{interviewSetup.company_analysis.company_name}</p>
                  </div>
                  <div className="rounded border p-2 text-center">
                    <p className="text-xs text-muted-foreground">면접관</p>
                    <p className="text-sm font-semibold">{interviewSetup.interviewers[0]?.name ?? '-'}</p>
                  </div>
                  <div className="rounded border p-2 text-center">
                    <p className="text-xs text-muted-foreground">질문 수</p>
                    <p className="text-sm font-semibold">{interviewSetup.questions.length}</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">데이터 없음</p>
              )}
            </StageCard>

            <PipelineArrow label="텍스트 채팅 면접 진행" />

            <StageCard
              step={4}
              color="bg-teal-600"
              icon={<MessageSquare className="h-4 w-4" />}
              title="Stage 2 — 텍스트 채팅 면접"
              duration={null}
              available={transcript.length > 0}
            >
              {transcript.length > 0 ? (
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded border p-2 text-center">
                    <p className="text-xs text-muted-foreground">대화 턴</p>
                    <p className="text-sm font-semibold">{transcript.length}</p>
                  </div>
                  <div className="rounded border p-2 text-center">
                    <p className="text-xs text-muted-foreground">면접관 발화</p>
                    <p className="text-sm font-semibold">{transcript.filter(t => t.speaker === 'interviewer').length}</p>
                  </div>
                  <div className="rounded border p-2 text-center">
                    <p className="text-xs text-muted-foreground">지원자 발화</p>
                    <p className="text-sm font-semibold">{transcript.filter(t => t.speaker === 'candidate').length}</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">데이터 없음</p>
              )}
            </StageCard>

            <PipelineArrow label="대화록 → 평가" />

            <StageCard
              step={5}
              color="bg-red-600"
              icon={<FileCheck className="h-4 w-4" />}
              title="Stage 3 — Gemini 평가"
              duration={evaluationMetrics?.durationMs}
              available={!!evaluationMetrics}
            >
              {evaluationMetrics ? (
                <div className="grid grid-cols-4 gap-2">
                  <div className="rounded border p-2 text-center">
                    <p className="text-xs text-muted-foreground">Input</p>
                    <p className="text-sm font-semibold">{evaluationMetrics.inputTokens.toLocaleString()}</p>
                  </div>
                  <div className="rounded border p-2 text-center">
                    <p className="text-xs text-muted-foreground">Output</p>
                    <p className="text-sm font-semibold">{evaluationMetrics.outputTokens.toLocaleString()}</p>
                  </div>
                  <div className="rounded border p-2 text-center">
                    <p className="text-xs text-muted-foreground">Finish</p>
                    <p className="text-sm font-semibold">{evaluationMetrics.finishReason}</p>
                  </div>
                  <div className="rounded border p-2 text-center">
                    <p className="text-xs text-muted-foreground">등급</p>
                    <p className="text-sm font-semibold">{evaluation?.overall_evaluation?.overall_grade ?? '-'}</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">데이터 없음</p>
              )}
            </StageCard>
          </TabsContent>

          {/* ═══ Stage 2 상세 탭 ═══ */}
          <TabsContent value="stage2" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <MessageSquare className="h-4 w-4" />
                  텍스트 채팅 면접 메트릭
                </CardTitle>
              </CardHeader>
              <CardContent>
                {transcript.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <MetricBox label="전체 대화 턴" value={transcript.length} sub="트랜스크립트" />
                    <MetricBox label="면접관 발화" value={transcript.filter(t => t.speaker === 'interviewer').length} sub="interviewer" />
                    <MetricBox label="지원자 발화" value={transcript.filter(t => t.speaker === 'candidate').length} sub="candidate" />
                    <MetricBox label="마지막 발화" value={transcript.length > 0 ? new Date(transcript[transcript.length - 1].timestamp).toLocaleTimeString('ko-KR') : '-'} sub="timestamp" />
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">텍스트 채팅 데이터 없음</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═══ Stage 3 상세 탭 ═══ */}
          <TabsContent value="stage3" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileCheck className="h-4 w-4" />
                  평가 API 메트릭
                </CardTitle>
              </CardHeader>
              <CardContent>
                {evaluationMetrics ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <MetricBox label="소요 시간" value={`${(evaluationMetrics.durationMs / 1000).toFixed(1)}s`} />
                    <MetricBox label="Input Tokens" value={evaluationMetrics.inputTokens.toLocaleString()} />
                    <MetricBox label="Output Tokens" value={evaluationMetrics.outputTokens.toLocaleString()} />
                    <MetricBox label="Finish Reason" value={evaluationMetrics.finishReason} />
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">평가 메트릭 데이터 없음</p>
                )}
              </CardContent>
            </Card>

            {/* Raw Response Viewer for Stage 3 */}
            {spans.filter((s) => s.stage === 'stage3').map((span) => (
              <Card key={span.id}>
                <CardHeader>
                  <CardTitle className="text-base">Stage 3 Raw Response</CardTitle>
                </CardHeader>
                <CardContent>
                  <CopyableBlock label="Raw Response" text={span.rawResponse} />
                </CardContent>
              </Card>
            ))}

            {evaluation && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <CheckCircle2 className="h-4 w-4" />
                    평가 결과 요약
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <MetricBox label="종합 등급" value={evaluation.overall_evaluation.overall_grade} />
                    <MetricBox label="채용 추천" value={evaluation.overall_evaluation.hire_recommendation} />
                    <MetricBox label="투입 준비도" value={evaluation.overall_evaluation.job_readiness.readiness_level} />
                    <MetricBox label="질문 평가" value={`${evaluation.question_evaluations.length}건`} />
                  </div>
                  <Separator />
                  <div>
                    <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">스킬 레이더</p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                      {Object.entries(evaluation.skill_radar).map(([key, val]) => (
                        <div key={key} className="rounded border p-2 text-center">
                          <p className="text-xs text-muted-foreground">{key.replace(/_/g, ' ')}</p>
                          <p className="text-sm font-semibold">{val}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <Separator />
                  <div>
                    <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">종합 평가</p>
                    <p className="text-sm leading-relaxed">{evaluation.overall_evaluation.summary}</p>
                  </div>
                  {evaluation.overall_evaluation.key_strengths.length > 0 && (
                    <div>
                      <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">주요 강점</p>
                      <ul className="list-inside list-disc space-y-1 text-sm">
                        {evaluation.overall_evaluation.key_strengths.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {evaluation.overall_evaluation.key_improvements.length > 0 && (
                    <div>
                      <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">개선 사항</p>
                      <ul className="list-inside list-disc space-y-1 text-sm">
                        {evaluation.overall_evaluation.key_improvements.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ═══ LLM Spans 탭 ═══ */}
          <TabsContent value="llm-spans" className="space-y-3">
            {spans.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Brain className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">LLM Span 데이터 없음</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    파이프라인 실행 후 각 Stage의 프롬프트와 응답 원문을 확인할 수 있습니다.
                  </p>
                </CardContent>
              </Card>
            ) : (
              spans.map((span) => <LLMSpanCard key={span.id} span={span} />)
            )}
          </TabsContent>

          {/* ═══ Errors 탭 ═══ */}
          <TabsContent value="errors">
            <ErrorTable errors={errors} />
          </TabsContent>

          {/* ═══ Timeline 탭 ═══ */}
          <TabsContent value="timeline">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <List className="h-4 w-4" />
                  파이프라인 타임라인
                  {timeline.length > 0 && (
                    <Badge variant="outline" className="ml-2 text-xs">{timeline.length}개 이벤트</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <TimelineView events={timeline} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
