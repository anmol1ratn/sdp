import { error, isHttpError, json } from '@sveltejs/kit';
import { z } from 'zod';
import type { Attachment } from '$lib/practice/types';
import { configFrom, reserve, settle } from '$lib/server/practice/budget';
import {
  getProblem,
  initialState,
  normalizeReview,
  promptFor,
  rulesFor
} from '$lib/server/practice/problem';
import {
  clarificationSchema,
  gemini,
  ProviderResponseError,
  reviewSchema,
  validateProviderInput
} from '$lib/server/practice/provider';
import {
  context,
  limitedJson,
  readState,
  validateAttachments,
  workspace
} from '$lib/server/practice/store';
import type { RequestHandler } from './$types';

const bodySchema = z.object({
  action: z.enum(['save', 'clarify', 'review', 'challenge']),
  problem: z.string().min(1).max(80).default('meeting-room'),
  stage: z.number().int().positive(),
  version: z.number().int().min(0),
  draft: z.string().max(24000).default(''),
  attachments: z.array(z.string().uuid()).max(2).default([]),
  text: z.string().max(4000).default(''),
  requestId: z.string().uuid().optional(),
  submissionId: z.string().uuid().optional()
});
export const GET: RequestHandler = async (event) =>
  json(
    await workspace(
      context(event),
      event.url.searchParams.get('problem') ?? 'meeting-room',
      Number(event.url.searchParams.get('stage') ?? 1)
    )
  );
export const POST: RequestHandler = async (event) => {
  if (event.request.headers.get('origin') !== event.url.origin)
    error(403, 'Same-origin requests only.');
  const parsed = bodySchema.safeParse(await limitedJson(event.request));
  if (!parsed.success) error(400, 'Invalid practice request.');
  const body = parsed.data,
    ctx = context(event),
    problemId = body.problem;
  const row = await readState(ctx, problemId, body.stage),
    id = row.id;
  if (body.action === 'save') {
    if (row.state.accepted)
      error(409, 'This stage is accepted and preserved. Open the next stage or view history.');
    const attachments = await validateAttachments(ctx, problemId, body.attachments);
    const state = { ...row.state, draft: body.draft, attachments };
    const result = await ctx.db
      .prepare(
        'UPDATE practice_state SET body=?, version=version+1 WHERE id=? AND version=? AND busy_until<?'
      )
      .bind(JSON.stringify(state), id, body.version, Date.now())
      .run();
    if (!result.meta.changes)
      error(
        409,
        'This draft changed in another tab or a review is running. Reload before saving; your local text is retained.'
      );
    return json(await workspace(ctx, problemId, body.stage));
  }
  const config = configFrom(ctx.env);
  if (!config.key)
    error(
      503,
      'Live AI is not configured yet. Add GEMINI_API_KEY on the server when ready. Your saved draft is safe; no review or progress was invented.'
    );
  if (!body.requestId) error(400, 'A request ID is required.');
  const callId = `${ctx.owner}:${problemId}:${body.requestId}`;
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(JSON.stringify(body))
  );
  const fingerprint = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const prior = await ctx.db
    .prepare('SELECT fingerprint,result FROM ai_calls WHERE id=?')
    .bind(callId)
    .first<{ fingerprint: string; result: string | null }>();
  if (prior) {
    if (prior.fingerprint !== fingerprint)
      error(409, 'A request ID cannot be reused for different work.');
    if (prior.result) {
      const result = JSON.parse(prior.result);
      if (result.error) error(502, result.error);
      return json(await workspace(ctx, problemId, body.stage));
    }
    error(
      409,
      'This request was already started. Refresh to check its result; it will not be sent twice.'
    );
  }
  if (row.state.accepted) error(409, 'This stage has already been accepted.');
  if (row.version !== body.version)
    error(409, 'Your saved draft has changed. Reload before requesting feedback.');
  if (body.action === 'clarify' && row.state.exchanges >= 3)
    error(409, 'All three exchanges are complete; all current-stage requirements are now shown.');
  if (body.action === 'challenge' && row.state.challenges >= 2)
    error(
      429,
      'Two feedback challenges per stage are available. You can still revise and resubmit.'
    );
  if ((body.action === 'clarify' || body.action === 'challenge') && !body.text.trim())
    error(400, 'Write a question first.');
  const count = await ctx.db
    .prepare(
      'SELECT COUNT(*) AS n FROM practice_submissions WHERE owner=? AND problem=? AND stage=?'
    )
    .bind(ctx.owner, problemId, body.stage)
    .first<{ n: number }>();
  if (body.action === 'review' && (count?.n ?? 0) >= 12)
    error(429, 'The 12-review limit for this stage is reached. Your work is preserved.');
  const active = await ctx.db
    .prepare(
      'UPDATE practice_state SET busy=?,busy_until=? WHERE id=? AND version=? AND busy_until<?'
    )
    .bind(callId, Date.now() + 120000, id, row.version, Date.now())
    .run();
  if (!active.meta.changes)
    error(409, 'Another request is running for this stage. Wait for it to finish.');
  let reserved: number | null = null;
  let actualCharge: number | null = null;
  try {
    const state = structuredClone(row.state);
    let answer = state.draft,
      attachments: Attachment[] = state.attachments,
      submissionId = crypto.randomUUID() as string;
    let previousReview: unknown = null;
    if (body.action === 'review' && !answer.trim() && !attachments.length)
      error(400, 'Add an answer or diagram before submitting.');
    if (body.action === 'challenge') {
      const sub = await ctx.db
        .prepare(
          'SELECT * FROM practice_submissions WHERE id=? AND owner=? AND problem=? AND stage=?'
        )
        .bind(body.submissionId ?? '', ctx.owner, problemId, body.stage)
        .first<{ id: string; answer: string; attachments: string }>();
      if (!sub) error(404, 'Submission not found.');
      answer = sub.answer;
      attachments = JSON.parse(sub.attachments);
      submissionId = sub.id;
      const latest = await ctx.db
        .prepare(
          'SELECT body FROM practice_reviews WHERE submission=? ORDER BY created_at DESC LIMIT 1'
        )
        .bind(sub.id)
        .first<{ body: string }>();
      previousReview = latest ? JSON.parse(latest.body) : null;
    }
    const images: { mime: string; data: string }[] = [];
    if (body.action !== 'clarify')
      for (const attachment of attachments) {
        const bucket = ctx.env.ATTACHMENTS;
        if (!bucket) error(503, 'Image storage is not configured.');
        const object =
          (await bucket.get(`${ctx.owner}/${problemId}/${attachment.id}`)) ??
          (await bucket.get(`${ctx.owner}/${attachment.id}`));
        if (!object) error(409, 'An image could not be loaded. Your draft is unchanged.');
        const bytes = new Uint8Array(await object.arrayBuffer());
        images.push({ mime: attachment.mime, data: Buffer.from(bytes).toString('base64') });
      }
    const providerRequest = {
      system: promptFor(problemId, state, body.action),
      text: JSON.stringify({
        question: body.text,
        answer: body.action === 'clarify' ? undefined : answer,
        previousReview
      }),
      images,
      kind: body.action
    };
    validateProviderInput(providerRequest);
    reserved = await reserve(ctx.db, callId, ctx.owner, fingerprint, config, problemId);
    const result = await gemini.generate(config, providerRequest);
    actualCharge = result.charged;
    const charged = actualCharge ?? reserved;
    if (!result.value) {
      await settle(ctx.db, callId, charged, {
        error:
          'The reviewer returned incomplete or invalid feedback. Your draft and clarification allowance are unchanged.'
      });
      error(
        502,
        'The reviewer returned incomplete or invalid feedback. Please try again; your work is saved.'
      );
    }
    // Fence delayed requests after a lease expires; no stale review can advance a newer state.
    const fence = await ctx.db
      .prepare('SELECT busy FROM practice_state WHERE id=?')
      .bind(id)
      .first<{ busy: string }>();
    if (fence?.busy !== callId) {
      await settle(ctx.db, callId, charged, {
        error: 'This review finished after its session expired. No progress was changed.'
      });
      error(409, 'The review expired. Your draft is safe.');
    }
    const writes = [];
    if (body.action === 'clarify') {
      const response = clarificationSchema.parse(result.value);
      const validIds = rulesFor(problemId, body.stage).map((r) => r.id);
      state.known = [
        ...new Set([...state.known, ...response.ruleIds.filter((r) => validIds.includes(r))])
      ];
      state.assumptions = [...new Set([...state.assumptions, ...response.assumptions])].slice(
        0,
        16
      );
      state.chat.push(
        { role: 'learner', text: body.text },
        { role: 'guide', text: response.text, correction: response.platformCorrection }
      );
      if (response.platformCorrection) state.corrections++;
      else state.exchanges++;
      if (state.exchanges === 3) {
        state.known = validIds;
        state.revealed = true;
      }
    } else {
      const review = normalizeReview(reviewSchema.parse(result.value), problemId, state);
      state.known = [
        ...new Set([
          ...state.known,
          ...review.findings
            .map((f) => f.ruleId)
            .filter(
              (v): v is string => !!v && rulesFor(problemId, body.stage).some((r) => r.id === v)
            )
        ])
      ];
      if (body.action === 'review')
        writes.push(
          ctx.db
            .prepare(
              'INSERT INTO practice_submissions(id,owner,problem,stage,answer,attachments,created_at) VALUES (?,?,?,?,?,?,?)'
            )
            .bind(
              submissionId,
              ctx.owner,
              problemId,
              body.stage,
              answer,
              JSON.stringify(attachments),
              Date.now()
            )
        );
      else state.challenges++;
      writes.push(
        ctx.db
          .prepare(
            'INSERT INTO practice_reviews(id,submission,body,challenge,created_at) VALUES (?,?,?,?,?)'
          )
          .bind(
            crypto.randomUUID(),
            submissionId,
            JSON.stringify(review),
            body.action === 'challenge' ? body.text : null,
            Date.now()
          )
      );
      if (review.verdict === 'accepted') {
        state.accepted = submissionId;
        const problem = getProblem(problemId),
          stageIndex = problem.stages.findIndex((stage) => stage.id === body.stage),
          nextStage = problem.stages[stageIndex + 1];
        if (nextStage)
          writes.push(
            ctx.db
              .prepare(
                'INSERT OR IGNORE INTO practice_state(id,owner,problem,stage,body) VALUES (?,?,?,?,?)'
              )
              .bind(
                `${ctx.owner}:${problemId}:${nextStage.id}`,
                ctx.owner,
                problemId,
                nextStage.id,
                JSON.stringify(
                  initialState(problemId, nextStage.id, { ...state, draft: answer, attachments })
                )
              )
          );
      }
    }
    // Lease fence assertion is in the same transaction as immutable snapshots and advancement.
    writes.unshift(
      ctx.db
        .prepare(
          'INSERT INTO practice_fence(id) SELECT ? WHERE NOT EXISTS(SELECT 1 FROM practice_state WHERE id=? AND busy=?)'
        )
        .bind('invalid', id, callId)
    );
    writes.push(
      ctx.db
        .prepare(
          'UPDATE practice_state SET body=?,version=version+1,busy=NULL,busy_until=0 WHERE id=? AND busy=?'
        )
        .bind(JSON.stringify(state), id, callId)
    );
    writes.push(
      ctx.db
        .prepare('UPDATE ai_calls SET charged=?,settled=1,result=? WHERE id=? AND settled=0')
        .bind(charged, JSON.stringify({ ok: true }), callId)
    );
    await ctx.db.batch(writes);
    return json(await workspace(ctx, problemId, body.stage));
  } catch (e) {
    if (reserved !== null)
      await settle(
        ctx.db,
        callId,
        actualCharge ?? (e instanceof ProviderResponseError ? e.charged : reserved),
        {
          error: isHttpError(e)
            ? e.body.message
            : e instanceof ProviderResponseError
              ? e.message
              : 'The request did not finish. Your work is saved; try again.'
        }
      );
    if (e instanceof ProviderResponseError) error(502, e.message);
    throw e;
  } finally {
    await ctx.db
      .prepare('UPDATE practice_state SET busy=NULL,busy_until=0 WHERE id=? AND busy=?')
      .bind(id, callId)
      .run();
  }
};
