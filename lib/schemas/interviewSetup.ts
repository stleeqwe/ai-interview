import { z } from 'zod';

export const InterviewerSchema = z.object({
  name: z.string().describe('면접관 한국 이름'),
  role: z.string().describe('직급 (예: 개발팀 팀장)'),
  personality: z.enum(['온화함', '날카로움', '중립적']),
  focus_area: z.string().describe('주로 질문할 영역'),
});

export const QuestionSchema = z.object({
  id: z.number(),
  category: z.enum(['이력서 기반', '공고 기반', '일반 기술']),
  question: z.string(),
  intent: z.string().describe('이 질문을 통해 확인하려는 역량'),
  expected_answer_direction: z.string(),
  follow_up_guides: z.array(z.string()),
  evaluation_criteria: z.object({
    technical_accuracy: z.string(),
    logical_structure: z.string(),
    specificity: z.string(),
  }),
  difficulty: z.enum(['하', '중', '상']),
});

export const InterviewSetupSchema = z.object({
  company_analysis: z.object({
    company_name: z.string(),
    industry: z.string(),
    company_size: z.enum(['스타트업', '중견기업', '대기업']),
    position: z.string(),
    seniority_level: z.enum(['신입', '주니어(1-3년)', '미드레벨(4-7년)', '시니어(8년+)']),
  }),
  candidate_analysis: z.object({
    strengths: z.array(z.string()),
    weaknesses: z.array(z.string()),
    key_experiences: z.array(z.string()),
  }),
  interviewers: z.array(InterviewerSchema).min(1).max(1),
  questions: z.array(QuestionSchema).min(1),
});

export type InterviewSetupJSON = z.infer<typeof InterviewSetupSchema>;
export type InterviewerInfo = z.infer<typeof InterviewerSchema>;
export type QuestionInfo = z.infer<typeof QuestionSchema>;
