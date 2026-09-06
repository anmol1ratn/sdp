import { beforeEach, expect, it, vi } from 'vitest';
import { database } from '../../../../tests/support/d1';
import { GET, POST } from '../../../routes/api/practice/+server';
import { gemini, ProviderResponseError } from './provider';

vi.mock('./provider', async (original) => ({
  ...(await original<typeof import('./provider')>()),
  gemini: { generate: vi.fn() }
}));
let fixture: ReturnType<typeof database>;
beforeEach(() => {
  fixture = database();
  vi.mocked(gemini.generate).mockReset();
});
function event(
  body?: unknown,
  options: { owner?: string; key?: boolean; stage?: number; problem?: string; origin?: string } = {}
) {
  const url = new URL(
    `http://localhost/api/practice?problem=${options.problem ?? 'meeting-room'}&stage=${options.stage ?? 1}`
  );
  return {
    url,
    request: new Request(url, {
      method: body ? 'POST' : 'GET',
      headers: { origin: options.origin ?? url.origin, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    }),
    locals: { user: { id: options.owner ?? 'reader', email: 'reader@example.com' } },
    platform: {
      env: {
        DB: fixture.db,
        ...(options.key === false ? {} : { GEMINI_API_KEY: 'test-not-a-real-key' })
      }
    }
  } as unknown as Parameters<typeof POST>[0];
}
async function get(stage = 1) {
  return (await GET(event(undefined, { stage }))).json();
}
async function post(body: Record<string, unknown>, options = {}) {
  return (await POST(event(body, options))).json();
}
const accepted = {
  verdict: 'accepted',
  summary: 'A coherent design.',
  strengths: ['Atomic booking'],
  findings: [],
  nextStep: 'Continue.'
};
it('saves durably, detects stale edits, and keeps stage two locked', async () => {
  const w = await get();
  expect(w.unlocked).toBe(1);
  const saved = await post({ action: 'save', stage: 1, version: 0, draft: 'My original design' });
  expect(saved.state.draft).toBe('My original design');
  await expect(
    post({ action: 'save', stage: 1, version: 0, draft: 'stale' })
  ).rejects.toMatchObject({ status: 409 });
  await expect(GET(event(undefined, { stage: 2 }))).rejects.toMatchObject({ status: 403 });
  expect((await get()).state.draft).toBe('My original design');
});
it('missing credentials preserve drafts without inventing review progress', async () => {
  await get();
  await post({ action: 'save', stage: 1, version: 0, draft: 'Design' });
  await expect(
    post({ action: 'review', stage: 1, version: 1, requestId: crypto.randomUUID() }, { key: false })
  ).rejects.toMatchObject({ status: 503 });
  expect((await get()).submissions).toHaveLength(0);
  expect(gemini.generate).not.toHaveBeenCalled();
});
it('refunds a provider-declared uncharged 503 without recording the clarification', async () => {
  await get();
  vi.mocked(gemini.generate).mockRejectedValue(new ProviderResponseError(503));
  await expect(
    post({
      action: 'clarify',
      stage: 1,
      version: 0,
      text: 'Keep this exact question in the composer',
      requestId: crypto.randomUUID()
    })
  ).rejects.toMatchObject({ status: 502 });
  const state = await get();
  expect(state.state.chat).toEqual([]);
  expect(state.state.exchanges).toBe(0);
  expect(fixture.sqlite.prepare('SELECT SUM(spent) AS spent FROM ai_budget').get()?.spent).toBe(0);
  expect(fixture.sqlite.prepare('SELECT charged FROM ai_calls').get()?.charged).toBe(0);
});
it('reveals remaining current rules after exactly three successful exchanges, excluding platform corrections', async () => {
  await get();
  vi.mocked(gemini.generate).mockResolvedValue({
    charged: 100,
    value: { text: 'Answer', ruleIds: [], assumptions: [], platformCorrection: true }
  });
  let w = await post({
    action: 'clarify',
    stage: 1,
    version: 0,
    text: 'Correct that',
    requestId: crypto.randomUUID()
  });
  expect(w.state.exchanges).toBe(0);
  expect(w.state.chat).toEqual([
    { role: 'learner', text: 'Correct that' },
    { role: 'guide', text: 'Answer', correction: true }
  ]);
  vi.mocked(gemini.generate).mockResolvedValue({
    charged: 100,
    value: {
      text: 'Answer',
      ruleIds: ['precision'],
      assumptions: ['No recurring meetings'],
      platformCorrection: false
    }
  });
  const questions = [
    'Must bookings use half-hour boundaries?',
    'How far ahead can an employee book?',
    'Can availability become stale before booking?'
  ];
  for (const text of questions)
    w = await post({
      action: 'clarify',
      stage: 1,
      version: w.version,
      text,
      requestId: crypto.randomUUID()
    });
  expect(w.state.exchanges).toBe(3);
  expect(w.state.revealed).toBe(true);
  expect(JSON.stringify(w.rules)).toContain('30 days');
  expect(JSON.stringify(w)).not.toContain('after a booking commits');
  const reloaded = await get();
  expect(reloaded.state.chat.map((message: { text: string }) => message.text)).toEqual([
    'Correct that',
    'Answer',
    questions[0],
    'Answer',
    questions[1],
    'Answer',
    questions[2],
    'Answer'
  ]);
  await expect(
    post({
      action: 'clarify',
      stage: 1,
      version: w.version,
      text: 'fourth',
      requestId: crypto.randomUUID()
    })
  ).rejects.toMatchObject({ status: 409 });
});
it('accepts a direct submission, snapshots it immutably, and copies stage two once', async () => {
  await get();
  await post({ action: 'save', stage: 1, version: 0, draft: 'Coherent original answer' });
  vi.mocked(gemini.generate).mockResolvedValue({ charged: 100, value: accepted });
  const request = { action: 'review', stage: 1, version: 1, requestId: crypto.randomUUID() };
  const w = await post(request);
  expect(w.unlocked).toBe(2);
  expect(w.state.accepted).toBeTruthy();
  expect(w.state.exchanges).toBe(0);
  await post(request);
  expect(gemini.generate).toHaveBeenCalledTimes(1);
  expect((await get(2)).state.draft).toBe('Coherent original answer');
  expect(() =>
    fixture.sqlite.prepare("UPDATE practice_submissions SET answer='changed'").run()
  ).toThrow('immutable');
  await expect(
    post({ action: 'save', stage: 1, version: w.version, draft: 'changed' })
  ).rejects.toMatchObject({ status: 409 });
});
it('retains failed request reservation and learner allowance, with retry deduplication', async () => {
  await get();
  vi.mocked(gemini.generate).mockRejectedValue(new Error('network'));
  const request = {
    action: 'clarify',
    stage: 1,
    version: 0,
    text: 'Question',
    requestId: crypto.randomUUID()
  };
  await expect(post(request)).rejects.toThrow();
  await expect(post(request)).rejects.toMatchObject({ status: 502 });
  expect(gemini.generate).toHaveBeenCalledTimes(1);
  expect((await get()).state.exchanges).toBe(0);
  expect(fixture.sqlite.prepare('SELECT charged FROM ai_calls').get()?.charged).toBeGreaterThan(0);
});
it('serializes live calls and rejects cross-origin requests', async () => {
  await get();
  let finish: (value: unknown) => void = () => {};
  vi.mocked(gemini.generate).mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve as (value: unknown) => void;
      })
  );
  const first = post({
    action: 'clarify',
    stage: 1,
    version: 0,
    text: 'Question',
    requestId: crypto.randomUUID()
  });
  await vi.waitFor(() => expect(gemini.generate).toHaveBeenCalledTimes(1));
  await expect(
    post({
      action: 'clarify',
      stage: 1,
      version: 0,
      text: 'Concurrent',
      requestId: crypto.randomUUID()
    })
  ).rejects.toMatchObject({ status: 409 });
  finish({
    charged: 100,
    value: { text: 'Done', ruleIds: [], assumptions: [], platformCorrection: false }
  });
  await first;
  await expect(
    post({ action: 'save', stage: 1, version: 1, draft: 'x' }, { origin: 'https://other.example' })
  ).rejects.toMatchObject({ status: 403 });
});

it('a challenge rechecks the immutable answer, preserves the newer draft and accepted stage one', async () => {
  await get();
  await post({ action: 'save', stage: 1, version: 0, draft: 'Original answer' });
  vi.mocked(gemini.generate).mockResolvedValue({
    charged: 100,
    value: {
      ...accepted,
      verdict: 'needs-revision',
      findings: [{ kind: 'missing-explanation', ruleId: null, text: 'Explain the lock' }]
    }
  });
  let w = await post({ action: 'review', stage: 1, version: 1, requestId: crypto.randomUUID() });
  w = await post({
    action: 'save',
    stage: 1,
    version: w.version,
    draft: 'A newer unsent revision'
  });
  vi.mocked(gemini.generate).mockResolvedValue({ charged: 100, value: accepted });
  w = await post({
    action: 'challenge',
    stage: 1,
    version: w.version,
    submissionId: w.submissions[0].id,
    text: 'The original answer already explains it.',
    requestId: crypto.randomUUID()
  });
  expect(JSON.parse(vi.mocked(gemini.generate).mock.calls.at(-1)![1].text).answer).toBe(
    'Original answer'
  );
  expect(w.state.draft).toBe('A newer unsent revision');
  expect(w.submissions[0].reviews).toHaveLength(2);
  expect((await get(2)).state.draft).toBe('Original answer');
  const second = await get(2);
  vi.mocked(gemini.generate).mockResolvedValue({
    charged: 100,
    value: { ...accepted, verdict: 'needs-revision' }
  });
  await post({
    action: 'review',
    stage: 2,
    version: second.version,
    requestId: crypto.randomUUID()
  });
  expect((await get()).state.accepted).toBe(w.state.accepted);
});

it('uses the mocked provider while keeping different problems isolated', async () => {
  await GET(event(undefined, { problem: 'url-shortener' }));
  await post({
    action: 'save',
    problem: 'url-shortener',
    stage: 1,
    version: 0,
    draft: 'URL shortener design'
  });
  vi.mocked(gemini.generate).mockResolvedValue({ charged: 100, value: accepted });
  const urlWorkspace = await post({
    action: 'review',
    problem: 'url-shortener',
    stage: 1,
    version: 1,
    requestId: crypto.randomUUID()
  });
  expect(urlWorkspace.unlocked).toBe(2);
  expect(urlWorkspace.state.problemId).toBe('url-shortener');

  const limiter = await (await GET(event(undefined, { problem: 'rate-limiter' }))).json();
  expect(limiter.state.draft).toBe('');
  expect(limiter.submissions).toHaveLength(0);
  expect(gemini.generate).toHaveBeenCalledTimes(1);
});
it('rejects another owner’s attachments and preserves image references in immutable snapshots', async () => {
  await get();
  const id = crypto.randomUUID();
  fixture.sqlite
    .prepare(
      'INSERT INTO practice_attachments(id,owner,name,mime,width,height,bytes,created_at) VALUES (?,?,?,?,?,?,?,?)'
    )
    .run(id, 'someone-else', 'Private', 'image/jpeg', 1, 1, 1, Date.now());
  await expect(
    post({ action: 'save', stage: 1, version: 0, draft: 'Design', attachments: [id] })
  ).rejects.toMatchObject({ status: 400 });
});
