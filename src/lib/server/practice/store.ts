import type { RequestEvent } from '@sveltejs/kit';
import { error } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { env as privateEnv } from '$env/dynamic/private';
import type {
  Attachment,
  ProblemSummary,
  Submission,
  WorkState,
  Workspace
} from '../../practice/types';
import { configFrom } from './budget';
import { getProblem, getStage, initialState, problemCatalog, visibleRules } from './problem';

export function context(event: RequestEvent) {
  if (!event.locals.user) error(401, 'Sign in to save your work.');
  const env = { ...privateEnv, ...event.platform?.env };
  if (dev && privateEnv.AUTH_TEST_MODE === 'true') env.GEMINI_API_KEY = '';
  const allowed = String(env.PRACTICE_ALLOWED_EMAILS ?? '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  if (!dev && (!allowed.length || !allowed.includes(event.locals.user.email.toLowerCase())))
    error(
      403,
      'This practice space is private. Ask its owner to add your email to the member list.'
    );
  if (!event.platform?.env.DB)
    error(503, 'The practice database is not configured. Your browser draft is retained.');
  return {
    db: event.platform.env.DB,
    owner: event.locals.user.id,
    env,
    local: dev && event.locals.user.id === 'local-practice'
  };
}
export type Context = ReturnType<typeof context>;
export function stateId(owner: string, problem: string, stage: number) {
  return `${owner}:${problem}:${stage}`;
}

export async function readState(ctx: Context, problemId: string, stageId: number) {
  const problem = getProblem(problemId),
    stage = getStage(problem, stageId);
  await ctx.db
    .prepare('INSERT OR IGNORE INTO practice_state(id,owner,problem,stage,body) VALUES (?,?,?,?,?)')
    .bind(
      stateId(ctx.owner, problem.id, 1),
      ctx.owner,
      problem.id,
      1,
      JSON.stringify(initialState(problem.id))
    )
    .run();
  const unlocked = await ctx.db
    .prepare('SELECT MAX(stage) AS stage FROM practice_state WHERE owner=? AND problem=?')
    .bind(ctx.owner, problem.id)
    .first<{ stage: number }>();
  const unlockedIndex = problem.stages.findIndex((item) => item.id === unlocked?.stage);
  if (stage.order > (unlockedIndex < 0 ? 1 : unlockedIndex + 1))
    error(403, 'Complete the previous stage before opening this one.');
  const row = await ctx.db
    .prepare(
      'SELECT id,body,version,busy,busy_until FROM practice_state WHERE owner=? AND problem=? AND stage=?'
    )
    .bind(ctx.owner, problem.id, stage.id)
    .first<{
      id: string;
      body: string;
      version: number;
      busy: string | null;
      busy_until: number;
    }>();
  if (!row) error(403, 'Complete the previous stage before opening this one.');
  const state = JSON.parse(row.body) as WorkState;
  state.problemId = problem.id;
  state.stage = stage.id;
  return { ...row, state, problem };
}

export async function workspace(
  ctx: Context,
  problemId: string,
  stageId: number
): Promise<Workspace> {
  const row = await readState(ctx, problemId, stageId),
    problem = row.problem;
  const submissions = await ctx.db
    .prepare(
      'SELECT id,stage,answer,attachments,created_at FROM practice_submissions WHERE owner=? AND problem=? ORDER BY created_at,id'
    )
    .bind(ctx.owner, problem.id)
    .all<Omit<Submission, 'reviews' | 'attachments'> & { attachments: string }>();
  const reviews = await ctx.db
    .prepare(
      'SELECT r.* FROM practice_reviews r JOIN practice_submissions s ON s.id=r.submission WHERE s.owner=? AND s.problem=? ORDER BY r.created_at,r.id'
    )
    .bind(ctx.owner, problem.id)
    .all<{
      id: string;
      submission: string;
      body: string;
      challenge: string | null;
      created_at: number;
    }>();
  const unlocked = await ctx.db
    .prepare('SELECT MAX(stage) AS stage FROM practice_state WHERE owner=? AND problem=?')
    .bind(ctx.owner, problem.id)
    .first<{ stage: number }>();
  const config = configFrom(ctx.env),
    month = new Date().toISOString().slice(0, 7);
  const budget = await ctx.db
    .prepare('SELECT spent FROM ai_budget WHERE id=?')
    .bind(`${ctx.owner}:${month}`)
    .first<{ spent: number }>();
  return {
    problem: problemCatalog.find((item) => item.id === problem.id)!,
    state: row.state,
    version: row.version,
    rules: visibleRules(problem.id, row.state),
    submissions: submissions.results.map((submission) => ({
      ...submission,
      attachments: JSON.parse(submission.attachments),
      reviews: reviews.results
        .filter((review) => review.submission === submission.id)
        .map((review) => ({
          id: review.id,
          review: JSON.parse(review.body),
          challenge: review.challenge,
          created_at: review.created_at
        }))
    })),
    unlocked: unlocked?.stage ?? problem.stages[0].id,
    aiReady: !!config.key,
    attachmentsReady: !!ctx.env.ATTACHMENTS && (dev || !!ctx.env.IMAGE_VALIDATOR),
    local: ctx.local,
    spent: (budget?.spent ?? 0) / 1e6,
    budget: config.userCap / 1e6,
    busy: row.busy_until > Date.now()
  };
}

export async function dashboard(ctx: Context): Promise<ProblemSummary[]> {
  const states = await ctx.db
    .prepare('SELECT problem,stage,body FROM practice_state WHERE owner=?')
    .bind(ctx.owner)
    .all<{ problem: string; stage: number; body: string }>();
  const attempts = await ctx.db
    .prepare(
      'SELECT problem,stage,COUNT(*) AS count FROM practice_submissions WHERE owner=? GROUP BY problem,stage'
    )
    .bind(ctx.owner)
    .all<{ problem: string; stage: number; count: number }>();
  return problemCatalog.map((problem) => {
    const ownStates = states.results.filter((row) => row.problem === problem.id);
    const acceptedStages = ownStates
      .filter((row) => (JSON.parse(row.body) as WorkState).accepted)
      .map((row) => row.stage);
    const attemptCounts = Object.fromEntries(
      attempts.results
        .filter((row) => row.problem === problem.id)
        .map((row) => [row.stage, row.count])
    );
    return {
      ...problem,
      unlocked: Math.max(problem.stages[0].id, ...ownStates.map((row) => row.stage)),
      acceptedStages,
      attemptCounts,
      hasDraft: ownStates.some((row) => !!(JSON.parse(row.body) as WorkState).draft)
    };
  });
}

export async function validateAttachments(
  ctx: Context,
  problemId: string,
  ids: string[]
): Promise<Attachment[]> {
  if (ids.length > 2 || new Set(ids).size !== ids.length)
    error(400, 'Attach at most two distinct images.');
  const out: Attachment[] = [];
  for (const id of ids) {
    const row = await ctx.db
      .prepare(
        'SELECT id,name,mime,width,height FROM practice_attachments WHERE id=? AND owner=? AND problem=?'
      )
      .bind(id, ctx.owner, problemId)
      .first<Attachment>();
    if (!row) error(400, 'An attachment is missing or belongs to another problem or user.');
    out.push(row);
  }
  return out;
}
export async function limitedJson(request: Request, maxBytes = 90000) {
  if (!request.body) error(400, 'Request body required.');
  const reader = request.body.getReader();
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > maxBytes) {
      await reader.cancel();
      error(413, 'This request is too large.');
    }
    chunks.push(value);
  }
  const all = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    all.set(chunk, offset);
    offset += chunk.length;
  }
  try {
    return JSON.parse(new TextDecoder().decode(all)) as unknown;
  } catch {
    error(400, 'Invalid JSON.');
  }
}
