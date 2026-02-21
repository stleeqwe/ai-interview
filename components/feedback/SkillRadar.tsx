'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { EvaluationJSON } from '@/lib/schemas/evaluation';

const SCORE_MAP = { '상': 3, '중': 2, '하': 1 } as const;
const SCORE_BADGE: Record<string, string> = {
  '상': 'text-green-700 bg-green-100',
  '중': 'text-yellow-700 bg-yellow-100',
  '하': 'text-red-700 bg-red-100',
};
const BAR_COLORS: Record<number, string> = {
  3: 'bg-green-500',
  2: 'bg-yellow-500',
  1: 'bg-red-500',
};

const SKILL_LABELS: Record<keyof EvaluationJSON['skill_radar'], string> = {
  technical_knowledge: '기술 지식',
  problem_solving: '문제 해결력',
  communication: '커뮤니케이션',
  experience_depth: '경험 깊이',
  culture_fit: '조직 적합성',
};

interface SkillRadarProps {
  skills: EvaluationJSON['skill_radar'];
}

export function SkillRadar({ skills }: SkillRadarProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">역량 분석</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {(Object.keys(SKILL_LABELS) as Array<keyof typeof SKILL_LABELS>).map((key) => {
          const value = skills[key];
          const score = SCORE_MAP[value] ?? 0;
          const percentage = (score / 3) * 100;

          return (
            <div key={key} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-sm">{SKILL_LABELS[key]}</span>
                <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${SCORE_BADGE[value] ?? ''}`}>
                  {value}
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${BAR_COLORS[score] ?? ''}`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
