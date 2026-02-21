import { z } from 'zod';

const FollowUpGuideSchema = z.object({
  trigger: z.string().describe('이 꼬리질문을 해야 하는 상황 (예: "추상적 답변 시")'),
  question: z.string().describe('구체적인 꼬리질문'),
  what_to_verify: z.string().describe('이 꼬리질문으로 확인하려는 것'),
});

const GapAnalysisSchema = z.object({
  missing_skills: z.array(z.object({
    skill: z.string(),
    importance: z.enum(['필수', '우대']),
    evidence_in_resume: z.string().describe('이력서에서 관련 근거가 없거나 부족한 이유'),
  })),
  credibility_flags: z.array(z.object({
    claim: z.string().describe('이력서에서 검증이 필요한 주장'),
    why_suspicious: z.string().describe('검증이 필요한 이유'),
    verification_approach: z.string().describe('면접에서 어떻게 검증할 것인지'),
  })),
});

export const InterviewerSchema = z.object({
  name: z.string().describe('면접관 한국 이름'),
  role: z.string().describe('직급 (예: 개발팀 팀장)'),
  personality: z.enum(['온화함', '날카로움', '중립적']),
  focus_area: z.string().describe('주로 질문할 영역'),
  speech_pattern: z.string().describe('말투 예시 (예: "~하신 거죠?", "구체적으로 어떤...")'),
  hiring_pressure: z.string().describe('이 면접관이 채용에 관심을 가지는 이유'),
});

export const QuestionSchema = z.object({
  id: z.number(),
  category: z.enum(['이력서 기반', '공고 기반', '상황/설계']),
  question: z.string(),
  intent: z.string().describe('이 질문을 통해 확인하려는 역량'),
  expected_answer_direction: z.string(),
  follow_up_guides: z.array(FollowUpGuideSchema).min(1).max(3),
  evaluation_criteria: z.object({
    technical_accuracy: z.string(),
    logical_structure: z.string(),
    specificity: z.string(),
  }),
  difficulty: z.enum(['하', '중', '상']),
  real_scenario: z.string().describe('이 질문과 관련된 실제 업무 상황 설명'),
  depth_probe_point: z.string().nullable().optional().describe('표면적으로는 쉬워 보이지만 깊이를 요구하는 탐색 포인트'),
  concern_signal: z.string().describe('이 답변이 나오면 역량 부족 가능성이 있는 답변 유형'),
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
    experience_depth_estimate: z.string().describe('이력서 기반 실제 역량 수준 추정'),
  }),
  gap_analysis: GapAnalysisSchema,
  interview_strategy: z.object({
    opening_approach: z.string().describe('면접 시작 시 분위기 설정 전략'),
    core_verification_points: z.array(z.string()).min(1).max(3).describe('이 면접에서 반드시 확인해야 할 핵심 포인트'),
    difficulty_escalation: z.string().describe('난이도 조절 전략'),
  }),
  interviewers: z.array(InterviewerSchema).min(1).max(1),
  questions: z.array(QuestionSchema).min(5).max(5),
});

export type InterviewSetupJSON = z.infer<typeof InterviewSetupSchema>;
export type InterviewerInfo = z.infer<typeof InterviewerSchema>;
export type QuestionInfo = z.infer<typeof QuestionSchema>;
