# Cloudflare SvelteKit starter

A deliberately small, production-minded full-stack starter for low-traffic applications. It deploys one
SvelteKit application to Cloudflare Workers, stores application and authentication data in D1, and keeps public
pages static where practical. There is no separate API service, monorepo, cache, queue, or paid dependency.

## Stack

- Svelte 5 and stable SvelteKit 2 with strict TypeScript
- Cloudflare Workers Static Assets and the official `@sveltejs/adapter-cloudflare`
- Cloudflare D1, Drizzle ORM, and committed SQL migrations
- Better Auth with Google OAuth and D1-backed sessions
- Tailwind CSS 4 without a component library
- Biome with experimental full Svelte support, plus mandatory `svelte-check`
- Vitest and Playwright
- pnpm with an exact package-manager version and committed lockfile

## Quick start

Requirements: Node.js 24 or newer, Corepack, and a Cloudflare account only when you are ready to deploy.

```sh
corepack enable
pnpm install --frozen-lockfile
cp .dev.vars.example .dev.vars
pnpm db:migrate:local
pnpm dev
```

Set real Google development credentials in `.dev.vars`. Local D1 data lives under `.wrangler/state` and is
separate from remote data. `pnpm dev` uses the Cloudflare adapter's local platform proxy, so the `DB` binding is
available in SvelteKit during development.

Useful commands:

```sh
pnpm check              # Svelte/framework/TypeScript diagnostics
pnpm format             # write Biome formatting
pnpm lint               # Biome lint
pnpm test:unit          # Vitest
pnpm test:e2e           # migrate/seed local D1 and run Playwright
pnpm build              # production Worker build
pnpm verify             # formatting/lint, diagnostics, unit tests, and build
pnpm dev:worker         # build, then run the Worker with Wrangler
pnpm db:generate        # generate a SQL migration after schema changes
pnpm db:migrate:local   # apply committed migrations to local D1
```

Before running browser tests for the first time, install the pinned Playwright browser:

```sh
pnpm exec playwright install chromium
```

CI uses `playwright install --with-deps chromium` to install the browser and its Linux system packages. The
browser suite seeds only the fixed user in `tests/fixtures/test-user.sql`; production migrations contain no test
data.

## Google OAuth and Better Auth

Create an OAuth 2.0 web application in Google Cloud. Add these authorized redirect URIs:

- Local: `http://localhost:5173/api/auth/callback/google`
- Production: `https://YOUR_DOMAIN/api/auth/callback/google`

Generate `BETTER_AUTH_SECRET` with at least 32 random characters. `.dev.vars.example` lists every required local
variable; `.dev.vars` is ignored by Git.

For production, add non-secret values to the top-level `vars` object in `wrangler.jsonc`:

```jsonc
"vars": {
  "BETTER_AUTH_URL": "https://YOUR_DOMAIN",
  "GOOGLE_CLIENT_ID": "YOUR_GOOGLE_CLIENT_ID"
}
```

Store secrets through Wrangler, never in the repository:

```sh
pnpm wrangler secret put BETTER_AUTH_SECRET
pnpm wrangler secret put GOOGLE_CLIENT_SECRET
```

Repeat with `--env preview` for the preview Worker. Google does not support wildcard OAuth redirect URIs, so a
preview deployment needs an explicitly registered stable hostname if OAuth must work there. The browser smoke
tests therefore use a deterministic auth seam that is compiled behind SvelteKit's development flag and requires
`AUTH_TEST_MODE=true`; request headers cannot activate it in a production build.

Email/password authentication is intentionally disabled. Password hashing can consume more than the Workers
Free plan's small per-request CPU allowance, and responsible verification/reset flows require an email service.
Better Auth owns secure, HTTP-only cookies and stores the authoritative sessions in D1.

## Database and migrations

The Drizzle schema is in `src/lib/server/db/schema.ts`; generated SQL is committed in `migrations/`. Change the
TypeScript schema, run `pnpm db:generate`, review the SQL, and apply it locally. Do not use schema push in
production.

To provision remote databases (these commands create Cloudflare resources, so they are intentionally not run by
the scaffold):

```sh
pnpm wrangler d1 create cloudflare-sveltekit-starter
pnpm wrangler d1 create cloudflare-sveltekit-starter-preview
```

Replace the two placeholder `database_id` values in `wrangler.jsonc`, then apply migrations:

```sh
pnpm db:migrate:remote
pnpm wrangler d1 migrations apply DB --env preview --remote
```

D1 does not support interactive transactions. Keep multi-step writes simple and use D1 batch operations when
atomic batches are needed.

## Deployment

Run `pnpm deploy` after the production database IDs, variables, and Worker secrets are configured. Wrangler
uploads static assets and the single SvelteKit Worker.

The deployment workflow uploads a preview Worker version for pull requests and deploys production from `main`.
Before enabling it, configure GitHub repository secrets `CLOUDFLARE_API_TOKEN` and
`CLOUDFLARE_ACCOUNT_ID`, replace both D1 ID placeholders, and configure Better Auth/Google values on each
Cloudflare Worker environment. Until then, the workflow stops with a specific setup error instead of guessing at
credentials or databases. Manual production runs are rejected unless dispatched from `main`. Give the API token
only the Worker and D1 permissions this deployment needs. CI itself needs no cloud credentials.

## Free-tier expectations

This starter targets roughly 50–100 people using a light application a few times per day. As of September 5,
2026, Workers Free documents 100,000 dynamic requests per day and 10 ms CPU per HTTP invocation; D1 Free
documents 5 million rows read per day, 100,000 rows written per day, and 5 GB total SQL storage. These are
current limits, not guarantees—check the authoritative [Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
and [Workers/D1 pricing](https://developers.cloudflare.com/workers/platform/pricing/) before launch.

Prerendered `/` and `/about` pages plus hashed build assets are served as static assets and do not invoke the
Worker. Authentication, `/app`, and server endpoints are dynamic. Keep queries indexed and bounded, watch CPU
time and D1 rows read, and treat a limit error as an operational event rather than silently degrading security.

## Architecture rationale

- Server hooks mount Better Auth and populate typed SvelteKit locals.
- A protected layout guards every `/app` route on the server.
- Form actions perform note writes; `+server.ts` endpoints demonstrate JSON boundaries.
- Zod validates environment data and untrusted form input.
- Text UUIDs use `crypto.randomUUID()`; timestamps are UTC epoch milliseconds in SQLite and `Date` values in
  application code.
- Application records are always scoped by the authenticated user ID.

Add R2 for large objects, Queues for deferred work, Cron for schedules, or Durable Objects for coordinated state
only after the application demonstrates that need. Transactional email is also an explicit future integration.

## Version policy

Runtime and development packages are exactly pinned to the newest stable compatible releases checked on
September 5, 2026. Run `pnpm outdated`, upgrade deliberately, and commit the resulting lockfile. Current
intentional exceptions:

- SvelteKit stays on stable `2.70.3`; SvelteKit 3 is prerelease-only.
- TypeScript stays on `6.0.3`; current SvelteKit 2 peer metadata does not accept TypeScript 7.
- Vitest stays on `4.1.11`; Better Auth 1.7's peer range does not accept Vitest 5.
- `@types/node` stays on the latest Node 24 line (`24.13.3`) to match the tested Node 24 CI/runtime
  target; the newest typings target Node 26.

Biome's Svelte formatter/linter support is experimental and explicitly enabled with
`html.experimentalFullSupportEnabled`. `svelte-check` remains mandatory because Biome does not replace
Svelte compiler, framework, or type diagnostics. ESLint and Prettier are intentionally absent.

## References

- [SvelteKit Cloudflare adapter](https://svelte.dev/docs/kit/adapter-cloudflare)
- [Cloudflare SvelteKit guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/sveltekit/)
- [D1 local development](https://developers.cloudflare.com/d1/best-practices/local-development/)
- [Better Auth SvelteKit integration](https://better-auth.com/docs/integrations/svelte-kit)
- [Better Auth Drizzle adapter](https://better-auth.com/docs/adapters/drizzle)
- [Biome language support](https://biomejs.dev/internals/language-support/)
