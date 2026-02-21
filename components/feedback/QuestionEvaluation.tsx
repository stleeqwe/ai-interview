'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import type { EvaluationJSON } from '@/lib/schemas/evaluation';

const GRADE_COLORS: Record<string, string> = {
  A: 'bg-green-100 text-green-800',
  B: 'bg-blue-100 text-blue-800',
  C: 'bg-yellow-100 text-yellow-800',
  D: 'bg-red-100 text-red-800',
};

const SCORE_STYLES: Record<string, string> = {
  '상': 'text-green-700',
  '중': 'text-yellow-700',
  '하': 'text-red-700',
};

interface QuestionEvaluationProps {
  questions: EvaluationJSON['question_evaluations'];
}

export function QuestionEvaluation({ questions }: QuestionEvaluationProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">질문별 평가</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {questions.map((q, idx) => (
          <div key={q.question_id}>
            {idx > 0 && <Separator className="mb-4" />}
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <p className="flex-1 text-sm font-medium">
                  Q{q.question_id}. {q.question_text}
                </p>
                <Badge className={GRADE_COLORS[q.grade] ?? ''} variant="outline">
                  {q.grade}
                </Badge>
              </div>

              <div className="rounded-lg bg-muted/50 p-2.5 text-xs text-muted-foreground">
                <span className="font-medium">답변 요약:</span> {q.candidate_answer_summary}
              </div>

              <p className="text-sm text-muted-foreground">{q.feedback}</p>

              <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted/50 p-2">
                {[
                  { label: '기술 정확성', data: q.scores.technical_accuracy },
                  { label: '논리 구조', data: q.scores.logical_structure },
                  { label: '구체성', data: q.scores.specificity },
                ].map(({ label, data }) => (
                  <div key={label} className="text-center">
                    <p className="text-[10px] text-muted-foreground">{label}</p>
                    <p className={`text-xs font-medium ${SCORE_STYLES[data.score] ?? ''}`}>
                      {data.score}
                    </p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground line-clamp-2">
                      {data.comment}
                    </p>
                  </div>
                ))}
              </div>

              <div className="rounded-lg bg-blue-50 p-3">
                <p className="text-[10px] font-medium text-blue-700 mb-1">모범 답변 방향</p>
                <p className="text-xs text-blue-900">{q.model_answer}</p>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
