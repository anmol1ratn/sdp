# Design Practice

A small, private system-design learning notebook for 4–5 people. It runs on SvelteKit and Cloudflare Workers, with D1 for drafts/history, R2 for image attachments, and a small private Durable Object for production image validation. The implementation is in `src/`; `output/` contains unrelated exploratory previews and is not the app.

## Run locally without cloud credentials

Requires Node 24+ and pnpm 11.25.0 (pinned in `package.json`).

```sh
pnpm install --frozen-lockfile
pnpm db:migrate:local
pnpm dev:local
```

Open the local URL printed by Vite. This command enables a fixed **local development identity**, only on a loopback host and only in SvelteKit development builds. Local D1 and R2 persist in `.wrangler/state`. It does not create or contact remote Cloudflare resources. No Gemini key is required to read, write, save, upload diagrams, or compare existing submissions. Live clarification and review require Gemini configuration; without it the app reports setup is required and never manufactures feedback or progress.

Use `pnpm dev` for the regular Google-authenticated development flow. Copy `.dev.vars.example` to `.dev.vars` when ready to supply environment values locally; the latter is ignored. Never put keys in frontend code or chat.

## Implemented learning flow

- A separate reading-list worked example shows sample clarifications, accepted assumptions, a numbered answer, and clearly labeled illustrative feedback. It does not award progress.
- The authored catalog contains Meeting-room booking (two stages), URL shortener (three), and Distributed rate limiter (three). Stable practice URLs include both the problem slug and stage; the legacy practice URL redirects to Meeting-room booking. Drafts, attachments, attempts, prompts, and progress are scoped independently per problem. Only the current stage’s public/confirmed rules are returned to the client; hidden rules and later-stage changes stay in server-only code.
- Each stage allows three successful clarification exchanges, including after opening the editor. Related questions can share an exchange. After the third, the server reveals the remaining current-stage rules and records requirements assistance. Provider failures, invalid output, and guide corrections do not consume learner exchanges; provider cost still counts.
- One Markdown/plain-text draft, two image attachments, autosave, a recoverable browser backup for unsaved changes, optimistic version checks across tabs, a resizable desktop split, editor focus, and narrow-screen Brief/Design views.
- Reviews distinguish accepted, needs revision, and clarification needed; findings distinguish wrong reasoning, missing explanation, unknown requirements, and unreadable images. Direct submission is allowed. The guide is instructed to accept alternative valid architectures and not invent requirements.
- Submission text and attachment references are immutable. Feedback challenges append a review to the original answer (two per stage), rather than changing it. There are up to 12 submitted reviews per stage, also constrained by the monthly budget.
- An accepted stage remains accepted. The next stage begins from that accepted snapshot, including images, with the new stage highlighted. If a challenge accepts an older answer, a newer saved draft remains available in comparison history.
- Basic progress and side-by-side comparison of any two distinct immutable attempts, with attempts numbered independently within each stage. Draft autosaves do not create attempts and never appear as a comparison side. No fake mastery scores, badges, or automated recall scheduling.

## Gemini configuration and accounting

Set `GEMINI_API_KEY` as a server secret. `GEMINI_MODEL` defaults to `gemini-3.8-flash`. Text and all attached images go together in **one multimodal generateContent request**; there is no separate OCR. The provider is isolated behind `ReviewProvider` in `src/lib/server/practice/provider.ts`.

Verified against Google’s official documentation on September 6, 2026:

- [Gemini 3.8 Flash model](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash): supports text/image inputs and low/medium/high thinking, with a 65,536 output-token model limit.
- [Gemini API prices](https://ai.google.dev/gemini-api/docs/pricing): standard input **$0.75/M** and output **$3.75/M**, including thinking, through December 31, 2026; **$1.50/M** and **$7.50/M** from January 1, 2027.
- [generateContent API](https://ai.google.dev/api/generate-content): inline image data, structured output, and usage metadata.

`budget.ts` automatically applies the dated price increase. Replacing the model requires explicit `AI_INPUT_USD_PER_MILLION` and `AI_OUTPUT_USD_PER_MILLION`; verify the replacement model’s thinking/output limits and adapter compatibility too. These are server-owned settings, never request fields.

`AI_USER_MONTHLY_USD` defaults to **5** and `AI_GLOBAL_MONTHLY_USD` to **25**. Calendar months use UTC. Before any generation, one D1 transaction initializes the applicable budget rows and inserts a reservation. SQLite triggers check and debit both the authenticated user and global balances atomically. Concurrent calls cannot independently spend the same remainder. A Gemini 503 response gets at most two delayed retries within the same reservation, following Google’s guidance for transient service unavailability. Other responses and ambiguous network failures are not retried. Request IDs are fingerprinted and deduplicated.

Input is bounded to 80,000 UTF-8 text bytes plus two normalized images. The app sets 8,192 output tokens and low thinking. Reservation is deliberately conservative: text byte bound + 16,384 input tokens per image, plus 8,192 output tokens **and** the model’s full 65,536-token ceiling for reasoning. This reserves about $0.36 at introductory rates, then refunds the difference using prompt, candidate, and thinking usage. Successful small requests normally cost much less than their reservation. An explicit provider error is refunded because Google does not bill failed 400/500-class requests; an ambiguous timeout/crash retains the maximum reservation to avoid undercounting. An owner can audit `ai_calls` against provider billing before any manual correction. A lease fences stale completions, and unfinished calls cannot be resent under the same ID.

The notebook displays spend **including pending/uncertain reservations**. Costs outside this app/key, provider price changes not reflected in configuration, taxes, and Cloudflare charges are not covered by this ledger. No tools, grounding, or paid fallbacks are enabled.

## Authentication and Cloudflare deployment

Production uses Cloudflare Access email-code login. Protect the `design-practice` Worker’s production and preview URLs with the Design Practice Access application. `wrangler.jsonc` sets `AUTH_MODE=cloudflare-access`, the trusted team URL (`ACCESS_TEAM_DOMAIN`), and the application audience (`ACCESS_AUD`). The server verifies the RS256 assertion signature, issuer, audience, expiry, and required user claims. It never trusts an email header or a client-provided user ID. Invalid or absent assertions fail closed; there is no fallback to Google login in Access mode. Public reading routes are protected at the Cloudflare Worker boundary.

A user’s owner ID is namespaced by the verified Access issuer and subject, and remains stable across login sessions. D1 drafts/history and R2 attachments already use that owner ID. Local development work belongs to the separate `local-practice` identity and is not copied into production automatically. No Access tokens are stored in D1 or exposed to the client. Existing Better Auth tables and the optional Google development flow are retained; production does not require Google or Better Auth secrets.

1. The production configuration targets Worker `design-practice`, D1 `design-practice-db`, and private R2 bucket `design-practice-attachments`. Local scripts explicitly use `wrangler.local.jsonc` to preserve the existing local database. The separate named preview environment still contains placeholders and must be configured before use.
2. When inviting a member, add their exact email to the Cloudflare Access policy. No app configuration change or redeploy is needed. In `cloudflare-access` mode the verified Access identity is sufficient; `PRACTICE_ALLOWED_EMAILS` is used only by legacy non-Access deployments.
3. Set the server secret with `pnpm exec wrangler secret put GEMINI_API_KEY --env=""`. Enter it at the prompt, never in source or chat. Default monthly app budgets are $5 per user and $25 globally; optional budget variables can override them. Draft saving and uploads work without this secret, but AI feedback does not.
4. Apply the existing schema with `pnpm db:migrate:remote`, then deploy using `pnpm deploy`. The `IMAGE_VALIDATOR` binding and SQLite Durable Object migration are included. Keep `worker.js` as the deployment entry: it exports the image validator beside the generated SvelteKit handler. The adapter configuration only controls generated build paths.
5. Smoke-test real Access login, draft save/reload, private image upload, and isolation between two members before sharing with the group. Test live AI feedback after configuring its secret. Verify the Access gate still covers the deployed Worker and its assets.

`AUTH_TEST_MODE` and `LOCAL_PRACTICE_MODE` are development-only. Do not expose the Vite development server publicly. See [Cloudflare JWT verification](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/). We validate the assertion directly because Workers Static Assets do not forward `ctx.access` to the user Worker.

## Images and local dictation

Images: select up to two PNG/JPEG/WebP files, at most 10 MiB each. The browser decodes and normalizes them to JPEG, removes metadata, constrains the longest edge to 2000px, and compresses to at most 2 MiB. The server independently checks actual format, fully decodes PNG/JPEG, and enforces byte/dimension/pixel bounds. In production, full decoding runs in the private `ImageValidator` SQLite-backed Durable Object. [SQLite Durable Objects are supported on Workers Free](https://developers.cloudflare.com/durable-objects/platform/pricing/) and have a [30-second default CPU allowance](https://developers.cloudflare.com/durable-objects/platform/limits/), avoiding the ordinary Worker’s 10 ms decoding bottleneck. In Vite development, the same decoder runs directly; `wrangler.local.jsonc` intentionally omits the unsupported same-script DO proxy. The separate local configuration uses the same local D1 ID and R2 bucket name. `pnpm test:worker` runs the actual validator inside workerd through a test-only entrypoint; that entrypoint is never part of the production route surface. WebP selection is supported through browser conversion; raw server WebP uploads are deliberately rejected. Stored images are private, owner checked, and referenced by immutable submission snapshots. Zoom previews let the learner inspect labels. A 100 MiB per-user attachment quota bounds storage; removing an image from a draft does not delete historical image bytes. Upload failures clean up R2 when metadata insertion fails; a hard process crash between those steps may leave an orphan for later owner maintenance.

Dictation: [`@moonshine-ai/moonshine-wasm`](https://github.com/moonshine-ai/moonshine/tree/main/language-bindings/wasm) **0.1.5**, using the English MediumStreaming model (245 million parameters). The installed SDK explicitly supports this architecture. Its larger first download and browser memory/CPU needs can increase startup time. Published float-reference accuracy scores are not a measured accuracy guarantee for the quantized browser model or the user’s speech. This is the current library, not archived `moonshine-js`. The library and this English model are MIT licensed per the [official model/license notes](https://github.com/moonshine-ai/moonshine). The build copies version-pinned WASM/browser modules into local static assets; model weights download from Moonshine’s CDN only on demand and are browser cached. The UI shows download progress, requests microphone permission only after a user starts dictation, provides stop/cancel, and writes completed phrases directly at the current caret/selection in the design editor or clarification composer. Interim guesses never modify saved text. Stop finishes the current phrase; Cancel discards unfinished speech and keeps text already added. Learners can keep typing while recording; each completed phrase uses the current text and selection, and design changes retain normal autosave. It never submits automatically. Audio stays in the browser; inserted text goes to the server only through normal save/clarification/review actions.

The page needs HTTPS (or localhost), WebAssembly/SIMD, SharedArrayBuffer, microphone support, and cross-origin isolation. `_headers` and server hooks set COOP/COEP and allow same-origin microphone use. Typing continues if loading or device support fails. Recording has a two-minute stop limit. No Cloudflare speech inference or browser speech-service fallback is used.

## Validation and operational limits

```sh
pnpm check
pnpm test:unit
pnpm test:e2e
pnpm test:worker
pnpm build
```

Browser tests use real local D1/R2 and development test identities. Server tests run the real SQL migrations/triggers through a SQLite-backed D1 adapter and mock only the external AI provider. They cover atomic budgets, global limits, accounting reconciliation, stage locks, stale writes, immutable history, challenges, hidden requirements, retries, payload shape, and image validation. Live provider judgments, Google OAuth, and remote Cloudflare bindings still need credentialed smoke tests. Tests never activate a real microphone. `TEST_MOONSHINE=1 pnpm exec playwright test -g 'optional real Moonshine'` is an opt-in network smoke test that loads the actual English MediumStreaming model and confirms zero microphone calls; model loading is tested without recording user speech.

Cloudflare’s [current Workers Free limits](https://developers.cloudflare.com/workers/platform/limits/) include 10 ms CPU per request and 128 MB per isolate. Network waiting for Gemini does not consume CPU. Full decoding has been moved to a Free-compatible Durable Object. Large multimodal payload assembly and authenticated rendering should still be profiled on the real account before promising production CPU headroom. Local emulation does not enforce the production CPU budget; no paid upgrade is assumed. Static Moonshine assets fit the individual asset-size limit and inference runs in the browser.

Generated schema migration metadata is in `migrations/meta`; `20260905184500_practice_guards.sql` separately owns accounting/immutability/quota triggers and the stale-request fence. The additive multi-problem migration defaults existing rows to Meeting-room booking, so prior work remains intact. Keep applied migrations immutable. Existing auth/note tables and unrelated preview files were preserved.
