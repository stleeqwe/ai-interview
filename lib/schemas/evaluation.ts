import { z } from 'zod';

const GradeEnum = z.enum(['A', 'B', 'C', 'D']);
const ScoreEnum = z.enum(['상', '중', '하']);

const ScoreDetail = z.object({
  score: ScoreEnum,
  comment: z.string(),
});

export const EvaluationSchema = z.object({
  overall_evaluation: z.object({
    overall_grade: GradeEnum,
    summary: z.string().describe('면접 전체에 대한 종합 평가 (3~5문장)'),
    hire_recommendation: z.enum(['강력 추천', '추천', '보류', '비추천']),
    key_strengths: z.array(z.string()),
    key_improvements: z.array(z.string()),
  }),
  question_evaluations: z.array(
    z.object({
      question_id: z.number(),
      question_text: z.string(),
      candidate_answer_summary: z.string(),
      grade: GradeEnum,
      scores: z.object({
        technical_accuracy: ScoreDetail,
        logical_structure: ScoreDetail,
        specificity: ScoreDetail,
      }),
      feedback: z.string(),
      model_answer: z.string(),
    })
  ),
  skill_radar: z.object({
    technical_knowledge: ScoreEnum,
    problem_solving: ScoreEnum,
    communication: ScoreEnum,
    experience_depth: ScoreEnum,
    culture_fit: ScoreEnum,
  }),
  action_items: z
    .array(
      z.object({
        priority: z.enum(['높음', '중간']),
        area: z.string(),
        action: z.string(),
        example: z.string(),
      })
    )
    .max(5),
});

export type EvaluationJSON = z.infer<typeof EvaluationSchema>;
