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
    strengths_feedback: z.array(z.string()).describe('면접에서 효과적으로 수행한 구체적 포인트'),
    seniority_fit: z.object({
      claimed_level: z.string(),
      assessed_level: z.string(),
      evidence: z.string(),
    }),
    job_readiness: z.object({
      readiness_level: z.enum(['즉시 투입 가능', '단기 적응 필요', '장기 준비 필요']),
      reason: z.string(),
    }),
    consistency_assessment: z.object({
      answer_consistency: z.enum(['구체적이고 일관됨', '추가 설명 필요', '경험 깊이 불확실']),
      details: z.string(),
    }),
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
      answer_structure_feedback: z.string().nullable().optional().describe('답변 구조 개선 피드백'),
      follow_up_performance: z.string().nullable().optional().describe('꼬리질문에 대한 답변 평가'),
      red_flag: z.string().nullable().optional().describe('우려되는 답변 패턴'),
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
  next_preparation_guide: z.string().describe('다음 면접까지의 구체적 준비 가이드'),
});

export type EvaluationJSON = z.infer<typeof EvaluationSchema>;
