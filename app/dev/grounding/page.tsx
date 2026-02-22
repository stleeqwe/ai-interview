'use client';

import { useInterviewStore } from '@/stores/interviewStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Search,
  Globe,
  FileText,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Brain,
  ExternalLink,
  Zap,
} from 'lucide-react';

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'success':
      return (
        <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
          <CheckCircle2 className="mr-1 h-3 w-3" /> 성공
        </Badge>
      );
    case 'skipped':
      return (
        <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
          <AlertTriangle className="mr-1 h-3 w-3" /> 스킵
        </Badge>
      );
    case 'error':
      return (
        <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
          <XCircle className="mr-1 h-3 w-3" /> 에러
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

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

export default function GroundingMonitorPage() {
  const groundingReport = useInterviewStore((s) => s.groundingReport);
  const analysisMetrics = useInterviewStore((s) => s.analysisMetrics);
  const interviewSetup = useInterviewStore((s) => s.interviewSetup);

  if (!groundingReport) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-background to-muted/30 px-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-12 text-center">
            <Search className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <h2 className="text-lg font-semibold">모니터링 데이터 없음</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              면접 시나리오를 생성하면 Grounding 리서치 결과가 여기에 표시됩니다.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalDuration =
    groundingReport.durationMs + (analysisMetrics?.durationMs ?? 0);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 px-4 py-8">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Stage 1 Grounding Monitor</h1>
            <p className="text-sm text-muted-foreground">
              {new Date(groundingReport.timestamp).toLocaleString('ko-KR')}
            </p>
          </div>
          <StatusBadge status={groundingReport.status} />
        </div>

        {/* 요약 메트릭 */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MetricBox
            label="검색 쿼리"
            value={groundingReport.searchQueries.length}
            sub="queries"
          />
          <MetricBox
            label="수집 소스"
            value={groundingReport.sources.length}
            sub="sources"
          />
          <MetricBox
            label="리서치 소요"
            value={`${(groundingReport.durationMs / 1000).toFixed(1)}s`}
            sub={`전체 ${(totalDuration / 1000).toFixed(1)}s`}
          />
          <MetricBox
            label="리포트 길이"
            value={groundingReport.researchText.length.toLocaleString()}
            sub="characters"
          />
        </div>

        {analysisMetrics && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricBox
              label="Gemini 소요"
              value={`${(analysisMetrics.durationMs / 1000).toFixed(1)}s`}
            />
            <MetricBox
              label="Input Tokens"
              value={analysisMetrics.inputTokens.toLocaleString()}
            />
            <MetricBox
              label="Output Tokens"
              value={analysisMetrics.outputTokens.toLocaleString()}
            />
            <MetricBox
              label="Stop Reason"
              value={analysisMetrics.finishReason}
            />
          </div>
        )}

        {groundingReport.errorMessage && (
          <Card className="border-red-200 dark:border-red-800">
            <CardContent className="flex items-start gap-3 py-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
              <div>
                <p className="font-medium text-red-700 dark:text-red-400">
                  에러 메시지
                </p>
                <p className="text-sm text-muted-foreground">
                  {groundingReport.errorMessage}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="pipeline" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="pipeline">
              <Zap className="mr-1.5 h-3.5 w-3.5" />
              파이프라인
            </TabsTrigger>
            <TabsTrigger value="queries">
              <Search className="mr-1.5 h-3.5 w-3.5" />
              검색 쿼리
            </TabsTrigger>
            <TabsTrigger value="sources">
              <Globe className="mr-1.5 h-3.5 w-3.5" />
              수집 소스
            </TabsTrigger>
            <TabsTrigger value="report">
              <FileText className="mr-1.5 h-3.5 w-3.5" />
              리서치 리포트
            </TabsTrigger>
          </TabsList>

          {/* 파이프라인 뷰 */}
          <TabsContent value="pipeline" className="space-y-4">
            <PipelineView
              groundingReport={groundingReport}
              analysisMetrics={analysisMetrics}
              interviewSetup={interviewSetup}
            />
          </TabsContent>

          {/* 검색 쿼리 */}
          <TabsContent value="queries" className="space-y-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Search className="h-4 w-4" />
                  Gemini가 실행한 Google 검색 쿼리
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {groundingReport.searchQueries.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    실행된 검색 쿼리가 없습니다.
                  </p>
                ) : (
                  groundingReport.searchQueries.map((query, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 rounded-lg border p-3"
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium">
                        {i + 1}
                      </span>
                      <p className="text-sm">{query}</p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* 수집 소스 */}
          <TabsContent value="sources" className="space-y-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Globe className="h-4 w-4" />
                  검색에서 수집된 웹 소스
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {groundingReport.sources.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    수집된 소스가 없습니다.
                  </p>
                ) : (
                  groundingReport.sources.map((source, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 rounded-lg border p-3"
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-medium dark:bg-blue-900">
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <a
                          href={source.uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
                        >
                          {source.title}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                        <p className="text-xs text-muted-foreground">
                          {source.domain}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* 소스 근거 매핑 */}
            {groundingReport.evidences.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    소스 근거 매핑 (Evidence → Source)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {groundingReport.evidences.map((ev, i) => (
                    <div key={i} className="rounded-lg border p-3">
                      <p className="text-sm">&ldquo;{ev.text}&rdquo;</p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {ev.sourceIndices.map((idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs">
                            소스 #{idx + 1}
                            {groundingReport.sources[idx] &&
                              ` — ${groundingReport.sources[idx].domain}`}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* 리서치 리포트 */}
          <TabsContent value="report">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="h-4 w-4" />
                  Gemini 리서치 리포트 전문
                </CardTitle>
              </CardHeader>
              <CardContent>
                {groundingReport.researchText ? (
                  <pre className="max-h-[600px] overflow-auto whitespace-pre-wrap rounded-lg bg-muted p-4 text-sm leading-relaxed">
                    {groundingReport.researchText}
                  </pre>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    리서치 리포트가 비어있습니다.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 파이프라인 뷰 — 전체 플로우를 단계별로 시각화                      */
/* ------------------------------------------------------------------ */

interface PipelineViewProps {
  groundingReport: NonNullable<ReturnType<typeof useInterviewStore.getState>['groundingReport']>;
  analysisMetrics: ReturnType<typeof useInterviewStore.getState>['analysisMetrics'];
  interviewSetup: ReturnType<typeof useInterviewStore.getState>['interviewSetup'];
}

function PipelineView({ groundingReport, analysisMetrics, interviewSetup }: PipelineViewProps) {
  return (
    <div className="space-y-4">
      {/* Step 1: Grounding Research */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
              1
            </span>
            <Search className="h-4 w-4" />
            Gemini + Google Search Grounding
            <span className="ml-auto text-sm font-normal text-muted-foreground">
              <Clock className="mr-1 inline h-3 w-3" />
              {(groundingReport.durationMs / 1000).toFixed(1)}s
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="mb-1.5 text-xs font-medium uppercase text-muted-foreground">
              실행된 검색 쿼리 ({groundingReport.searchQueries.length}건)
            </p>
            {groundingReport.searchQueries.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {groundingReport.searchQueries.map((q, i) => (
                  <Badge key={i} variant="outline" className="text-xs">
                    <Search className="mr-1 h-2.5 w-2.5" />
                    {q}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">검색 쿼리 없음</p>
            )}
          </div>

          <Separator />

          <div>
            <p className="mb-1.5 text-xs font-medium uppercase text-muted-foreground">
              수집된 웹 소스 ({groundingReport.sources.length}건)
            </p>
            {groundingReport.sources.length > 0 ? (
              <ul className="space-y-1">
                {groundingReport.sources.map((src, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs">
                    <Globe className="h-3 w-3 shrink-0 text-muted-foreground" />
                    <a
                      href={src.uri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate text-blue-600 hover:underline dark:text-blue-400"
                    >
                      {src.title}
                    </a>
                    <span className="shrink-0 text-muted-foreground">
                      ({src.domain})
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">수집된 소스 없음</p>
            )}
          </div>

          <Separator />

          <div>
            <p className="mb-1.5 text-xs font-medium uppercase text-muted-foreground">
              리서치 리포트 요약
            </p>
            {groundingReport.researchText ? (
              <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded bg-muted p-3 text-xs leading-relaxed">
                {groundingReport.researchText.slice(0, 1000)}
                {groundingReport.researchText.length > 1000 && '\n\n... (전체 보기는 "리서치 리포트" 탭)'}
              </pre>
            ) : (
              <p className="text-sm text-muted-foreground">리포트 없음</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Arrow */}
      <div className="flex justify-center">
        <div className="flex flex-col items-center text-muted-foreground">
          <div className="h-6 w-px bg-border" />
          <span className="text-xs">리서치 결과 주입</span>
          <div className="h-6 w-px bg-border" />
          <span className="text-lg">↓</span>
        </div>
      </div>

      {/* Step 2: Claude Stage 1 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-600 text-xs font-bold text-white">
              2
            </span>
            <Brain className="h-4 w-4" />
            Gemini Flash — 시나리오 생성
            {analysisMetrics && (
              <span className="ml-auto text-sm font-normal text-muted-foreground">
                <Clock className="mr-1 inline h-3 w-3" />
                {(analysisMetrics.durationMs / 1000).toFixed(1)}s
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {analysisMetrics && (
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded border p-2 text-center">
                <p className="text-xs text-muted-foreground">Input</p>
                <p className="text-sm font-semibold">
                  {analysisMetrics.inputTokens.toLocaleString()}
                </p>
              </div>
              <div className="rounded border p-2 text-center">
                <p className="text-xs text-muted-foreground">Output</p>
                <p className="text-sm font-semibold">
                  {analysisMetrics.outputTokens.toLocaleString()}
                </p>
              </div>
              <div className="rounded border p-2 text-center">
                <p className="text-xs text-muted-foreground">Stop</p>
                <p className="text-sm font-semibold">
                  {analysisMetrics.finishReason}
                </p>
              </div>
            </div>
          )}

          <Separator />

          {interviewSetup ? (
            <div className="space-y-3">
              <div>
                <p className="mb-1.5 text-xs font-medium uppercase text-muted-foreground">
                  생성된 시나리오
                </p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">회사: </span>
                    {interviewSetup.company_analysis.company_name}
                  </div>
                  <div>
                    <span className="text-muted-foreground">포지션: </span>
                    {interviewSetup.company_analysis.position}
                  </div>
                  <div>
                    <span className="text-muted-foreground">시니어리티: </span>
                    {interviewSetup.company_analysis.seniority_level}
                  </div>
                  <div>
                    <span className="text-muted-foreground">면접관: </span>
                    {interviewSetup.interviewers[0].name} (
                    {interviewSetup.interviewers[0].personality})
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <p className="mb-1.5 text-xs font-medium uppercase text-muted-foreground">
                  생성된 질문 ({interviewSetup.questions.length}개)
                </p>
                <div className="space-y-2">
                  {interviewSetup.questions.map((q, i) => (
                    <div key={i} className="rounded-lg border p-3">
                      <div className="mb-1 flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {q.category}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={
                            q.difficulty === '상'
                              ? 'border-red-300 text-red-700 dark:border-red-700 dark:text-red-400'
                              : q.difficulty === '중'
                                ? 'border-yellow-300 text-yellow-700 dark:border-yellow-700 dark:text-yellow-400'
                                : 'border-green-300 text-green-700 dark:border-green-700 dark:text-green-400'
                          }
                        >
                          난이도: {q.difficulty}
                        </Badge>
                      </div>
                      <p className="text-sm font-medium">{q.intent}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {q.real_scenario}
                      </p>
                      {q.follow_up_guides.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs text-muted-foreground">
                            꼬리질문 {q.follow_up_guides.length}개 설계됨
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              시나리오 데이터 없음
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
