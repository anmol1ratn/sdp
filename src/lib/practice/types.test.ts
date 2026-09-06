import { expect, it } from 'vitest';
import { attemptNumber, type Submission } from './types';

it('numbers immutable submissions independently within each stage', () => {
  const submissions = [
    { id: 'stage-1-a', stage: 1 },
    { id: 'stage-1-b', stage: 1 },
    { id: 'stage-2-a', stage: 2 },
    { id: 'stage-2-b', stage: 2 }
  ] as Pick<Submission, 'id' | 'stage'>[];
  expect(submissions.map((submission) => attemptNumber(submissions, submission))).toEqual([
    1, 2, 1, 2
  ]);
});
