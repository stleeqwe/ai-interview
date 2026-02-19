'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { EvaluationJSON } from '@/lib/schemas/evaluation';

const GRADE_STYLES: Record<string, string> = {
  A: 'bg-green-100 text-green-800 border-green-300',
  B: 'bg-blue-100 text-blue-800 border-blue-300',
  C: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  D: 'bg-red-100 text-red-800 border-red-300',
};

const HIRE_STYLES: Record<string, string> = {
  '강력 추천': 'bg-green-100 text-green-800',
  '추천': 'bg-blue-100 text-blue-800',
  '보류': 'bg-yellow-100 text-yellow-800',
  '비추천': 'bg-red-100 text-red-800',
};

interface OverallGradeProps {
  evaluation: EvaluationJSON['overall_evaluation'];
}

export function OverallGrade({ evaluation }: OverallGradeProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">종합 평가</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={HIRE_STYLES[evaluation.hire_recommendation] ?? ''}>
              {evaluation.hire_recommendation}
            </Badge>
            <span
              className={`flex h-12 w-12 items-center justify-center rounded-lg border-2 text-2xl font-bold ${
                GRADE_STYLES[evaluation.overall_grade] ?? ''
              }`}
            >
              {evaluation.overall_grade}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm leading-relaxed text-muted-foreground">
          {evaluation.summary}
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-green-700">강점</p>
            <ul className="space-y-1">
              {evaluation.key_strengths.map((s, i) => (
                <li key={i} className="text-sm flex items-start gap-1.5">
                  <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-green-500" />
                  {s}
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-red-700">개선점</p>
            <ul className="space-y-1">
              {evaluation.key_improvements.map((s, i) => (
                <li key={i} className="text-sm flex items-start gap-1.5">
                  <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-red-500" />
                  {s}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
