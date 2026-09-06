export type Stage = number;
export type StageMeta = {
  id: number;
  order: number;
  title: string;
  navTitle: string;
  brief: string;
  deliverables: string[];
  publicRules: { id: string; text: string }[];
};
export type ProblemMeta = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  difficulty: string;
  pace: string;
  focusSessions: string;
  estimatedDays: number;
  topics: string[];
  curriculumOrder: number;
  prerequisites: string[];
  stages: StageMeta[];
};
export type Attachment = { id: string; name: string; mime: string; width: number; height: number };
export type Message = { role: 'learner' | 'guide'; text: string; correction?: boolean };
export type Finding = {
  kind: 'incorrect' | 'missing-explanation' | 'unknown-requirement' | 'unreadable';
  ruleId: string | null;
  text: string;
};
export type Review = {
  verdict: 'accepted' | 'needs-revision' | 'clarification-needed';
  summary: string;
  strengths: string[];
  findings: Finding[];
  nextStep: string;
};
export type WorkState = {
  problemId: string;
  stage: Stage;
  draft: string;
  attachments: Attachment[];
  chat: Message[];
  known: string[];
  assumptions: string[];
  exchanges: number;
  corrections: number;
  challenges: number;
  revealed: boolean;
  accepted: string | null;
};
export type Submission = {
  id: string;
  stage: Stage;
  answer: string;
  attachments: Attachment[];
  created_at: number;
  reviews: { id: string; review: Review; challenge: string | null; created_at: number }[];
};
export type Workspace = {
  problem: ProblemMeta;
  state: WorkState;
  version: number;
  rules: { id: string; text: string }[];
  submissions: Submission[];
  unlocked: number;
  aiReady: boolean;
  attachmentsReady: boolean;
  local: boolean;
  spent: number;
  budget: number;
  busy: boolean;
};
export type ProblemSummary = ProblemMeta & {
  unlocked: number;
  acceptedStages: number[];
  attemptCounts: Record<number, number>;
  hasDraft: boolean;
};
export function attemptNumber(
  submissions: Pick<Submission, 'id' | 'stage'>[],
  submission: Pick<Submission, 'id' | 'stage'>
) {
  return (
    submissions
      .filter((item) => item.stage === submission.stage)
      .findIndex((item) => item.id === submission.id) + 1
  );
}
export const starterHeadings =
  '# Data model\n\n\n# Request flows\n\n\n# Correctness and tradeoffs\n\n';
