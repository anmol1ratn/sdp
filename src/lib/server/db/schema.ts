import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

const timestamps = {
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .$defaultFn(() => new Date())
    .notNull()
};

export const user = sqliteTable(
  'user',
  {
    id: text('id')
      .$defaultFn(() => crypto.randomUUID())
      .primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull(),
    emailVerified: integer('email_verified', { mode: 'boolean' }).default(false).notNull(),
    image: text('image'),
    ...timestamps
  },
  (table) => [uniqueIndex('user_email_unique').on(table.email)]
);

export const session = sqliteTable(
  'session',
  {
    id: text('id')
      .$defaultFn(() => crypto.randomUUID())
      .primaryKey(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    token: text('token').notNull(),
    ...timestamps,
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' })
  },
  (table) => [
    uniqueIndex('session_token_unique').on(table.token),
    index('session_user_id_idx').on(table.userId),
    index('session_expires_at_idx').on(table.expiresAt)
  ]
);

export const account = sqliteTable(
  'account',
  {
    id: text('id')
      .$defaultFn(() => crypto.randomUUID())
      .primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: integer('access_token_expires_at', { mode: 'timestamp_ms' }),
    refreshTokenExpiresAt: integer('refresh_token_expires_at', { mode: 'timestamp_ms' }),
    scope: text('scope'),
    password: text('password'),
    ...timestamps
  },
  (table) => [
    index('account_user_id_idx').on(table.userId),
    uniqueIndex('account_provider_account_unique').on(table.providerId, table.accountId)
  ]
);

export const verification = sqliteTable(
  'verification',
  {
    id: text('id')
      .$defaultFn(() => crypto.randomUUID())
      .primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    ...timestamps
  },
  (table) => [index('verification_identifier_idx').on(table.identifier)]
);

export const notes = sqliteTable(
  'notes',
  {
    id: text('id')
      .$defaultFn(() => crypto.randomUUID())
      .primaryKey(),
    ownerId: text('owner_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    body: text('body').notNull(),
    ...timestamps
  },
  (table) => [index('notes_owner_updated_idx').on(table.ownerId, table.updatedAt)]
);

export type Note = typeof notes.$inferSelect;

// Practice data uses server-authenticated owner IDs, including one fixed dev-only identity.
export const practiceState = sqliteTable(
  'practice_state',
  {
    id: text('id').primaryKey(),
    owner: text('owner').notNull(),
    problem: text('problem').notNull().default('meeting-room'),
    stage: integer('stage').notNull(),
    body: text('body').notNull(),
    version: integer('version').notNull().default(0),
    busy: text('busy'),
    busyUntil: integer('busy_until').notNull().default(0)
  },
  (t) => [uniqueIndex('practice_owner_problem_stage').on(t.owner, t.problem, t.stage)]
);
export const practiceSubmissions = sqliteTable(
  'practice_submissions',
  {
    id: text('id').primaryKey(),
    owner: text('owner').notNull(),
    problem: text('problem').notNull().default('meeting-room'),
    stage: integer('stage').notNull(),
    answer: text('answer').notNull(),
    attachments: text('attachments').notNull(),
    createdAt: integer('created_at').notNull()
  },
  (t) => [index('submissions_owner_problem_stage').on(t.owner, t.problem, t.stage)]
);
export const practiceReviews = sqliteTable(
  'practice_reviews',
  {
    id: text('id').primaryKey(),
    submission: text('submission')
      .notNull()
      .references(() => practiceSubmissions.id),
    body: text('body').notNull(),
    challenge: text('challenge'),
    createdAt: integer('created_at').notNull()
  },
  (t) => [index('reviews_submission').on(t.submission)]
);
export const practiceAttachments = sqliteTable(
  'practice_attachments',
  {
    id: text('id').primaryKey(),
    owner: text('owner').notNull(),
    problem: text('problem').notNull().default('meeting-room'),
    name: text('name').notNull(),
    mime: text('mime').notNull(),
    width: integer('width').notNull(),
    height: integer('height').notNull(),
    bytes: integer('bytes').notNull(),
    createdAt: integer('created_at').notNull()
  },
  (t) => [index('attachments_owner_problem').on(t.owner, t.problem)]
);
export const aiBudget = sqliteTable('ai_budget', {
  id: text('id').primaryKey(),
  spent: integer('spent').notNull().default(0),
  cap: integer('cap').notNull()
});
export const aiCalls = sqliteTable(
  'ai_calls',
  {
    id: text('id').primaryKey(),
    owner: text('owner').notNull(),
    problem: text('problem').notNull().default('meeting-room'),
    month: text('month').notNull(),
    fingerprint: text('fingerprint').notNull(),
    reserved: integer('reserved').notNull(),
    charged: integer('charged').notNull(),
    settled: integer('settled').notNull().default(0),
    result: text('result'),
    createdAt: integer('created_at').notNull()
  },
  (t) => [
    index('calls_owner_created').on(t.owner, t.createdAt),
    index('calls_owner_problem_created').on(t.owner, t.problem, t.createdAt)
  ]
);
