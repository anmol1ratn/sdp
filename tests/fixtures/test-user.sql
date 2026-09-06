INSERT OR IGNORE INTO user (
  id,
  name,
  email,
  email_verified,
  created_at,
  updated_at
) VALUES (
  '00000000-0000-4000-8000-000000000001',
  'Test User',
  'test@example.com',
  1,
  0,
  0
);

INSERT OR REPLACE INTO practice_state (id, owner, stage, body, version, busy, busy_until) VALUES
  ('stage-navigation:1', 'stage-navigation', 1, '{"stage":1,"draft":"Stage 1 accepted answer","attachments":[],"chat":[],"known":["scope","ownership"],"assumptions":[],"exchanges":0,"corrections":0,"challenges":0,"revealed":false,"accepted":"10000000-0000-4000-8000-000000000002"}', 2, NULL, 0),
  ('stage-navigation:2', 'stage-navigation', 2, '{"stage":2,"draft":"Stage 2 working draft","attachments":[],"chat":[],"known":["scope","precision","horizon","interval","timezone","ownership","availability","retries"],"assumptions":[],"exchanges":0,"corrections":0,"challenges":0,"revealed":false,"accepted":null}', 0, NULL, 0);

INSERT OR REPLACE INTO practice_submissions (id, owner, stage, answer, attachments, created_at) VALUES
  ('10000000-0000-4000-8000-000000000001', 'stage-navigation', 1, 'Stage 1 first answer', '[]', 100),
  ('10000000-0000-4000-8000-000000000002', 'stage-navigation', 1, 'Stage 1 accepted answer', '[]', 200),
  ('20000000-0000-4000-8000-000000000001', 'stage-navigation', 2, 'Stage 2 first answer', '[]', 300),
  ('20000000-0000-4000-8000-000000000002', 'stage-navigation', 2, 'Stage 2 second answer', '[]', 400);

INSERT OR REPLACE INTO practice_reviews (id, submission, body, challenge, created_at) VALUES
  ('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', '{"verdict":"accepted","summary":"Stage 1 accepted review","strengths":["Core correctness"],"findings":[],"nextStep":"Open stage 2"}', NULL, 210),
  ('30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', '{"verdict":"needs-revision","summary":"Stage 2 latest review","strengths":[],"findings":[],"nextStep":"Revise retry behavior"}', NULL, 410);

INSERT OR REPLACE INTO practice_state (id, owner, stage, body, version, busy, busy_until) VALUES
  ('single-attempt:1', 'single-attempt', 1, '{"stage":1,"draft":"Only submitted answer","attachments":[],"chat":[],"known":["scope","ownership"],"assumptions":[],"exchanges":0,"corrections":0,"challenges":0,"revealed":false,"accepted":null}', 1, NULL, 0);

INSERT OR REPLACE INTO practice_submissions (id, owner, stage, answer, attachments, created_at) VALUES
  ('40000000-0000-4000-8000-000000000001', 'single-attempt', 1, 'Only submitted answer', '[]', 100);
