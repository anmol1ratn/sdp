import { expect, it } from 'vitest';
import type { Review } from '../../practice/types';
import { initialState, normalizeReview, problemCatalog, promptFor, visibleRules } from './problem';

it('publishes three data-driven problems with the intended stage counts', () => {
  expect(problemCatalog.map((problem) => [problem.slug, problem.stages.length])).toEqual([
    ['meeting-room', 2],
    ['url-shortener', 3],
    ['rate-limiter', 3]
  ]);
  expect(
    problemCatalog.map(({ pace, estimatedDays, curriculumOrder, topics }) => ({
      pace,
      estimatedDays,
      curriculumOrder,
      topics
    }))
  ).toEqual([
    {
      pace: '3 days',
      estimatedDays: 3,
      curriculumOrder: 1,
      topics: ['Data modeling', 'Concurrency', 'Transactions']
    },
    {
      pace: '4 days',
      estimatedDays: 4,
      curriculumOrder: 2,
      topics: ['Data modeling', 'Caching', 'Multi-region']
    },
    {
      pace: '5 days',
      estimatedDays: 5,
      curriculumOrder: 3,
      topics: ['Concurrency', 'Distributed systems', 'Multi-region']
    }
  ]);
});

it('keeps the twist and hidden operating rules off stage-one learner data', () => {
  expect(JSON.stringify(visibleRules('meeting-room', initialState('meeting-room')))).not.toContain(
    '30 days'
  );
  expect(promptFor('meeting-room', initialState('meeting-room'), 'clarify')).not.toContain(
    'after a booking commits'
  );
  expect(promptFor('meeting-room', initialState('meeting-room', 2), 'review')).toContain(
    'lost response'
  );
});
it('distinguishes unknown requirements from known violations', () => {
  const review: Review = {
    verdict: 'needs-revision',
    summary: 'Time granularity',
    strengths: [],
    findings: [
      { kind: 'incorrect', ruleId: 'precision', text: 'Fixed slots miss arbitrary minute times.' }
    ],
    nextStep: 'Clarify times.'
  };
  const state = initialState('meeting-room');
  expect(normalizeReview(review, 'meeting-room', state).verdict).toBe('clarification-needed');
  state.known.push('precision');
  expect(normalizeReview(review, 'meeting-room', state).verdict).toBe('needs-revision');
});
it('does not accept unresolved unreadable images', () => {
  expect(
    normalizeReview(
      {
        verdict: 'accepted',
        summary: '',
        strengths: [],
        findings: [{ kind: 'unreadable', ruleId: null, text: 'Arrow unclear' }],
        nextStep: ''
      },
      'meeting-room',
      initialState('meeting-room')
    ).verdict
  ).toBe('clarification-needed');
});
