<script lang="ts">
let mobileView = $state<'brief' | 'design'>('brief');
let diagramOpen = $state(false);

function showBrief() {
  mobileView = 'brief';
}
function showDesign() {
  mobileView = 'design';
}
function showDiagram() {
  diagramOpen = true;
}
function hideDiagram() {
  diagramOpen = false;
}

function openModal(node: HTMLDialogElement) {
  node.showModal();
  return { destroy: () => node.close() };
}
</script>

<svelte:head><title>Webhook delivery worked example | Design Practice</title></svelte:head>

{#snippet architectureDiagram(large = false)}
  <svg
    class:large
    viewBox="0 0 920 430"
    role="img"
    aria-label="Webhook delivery architecture"
    aria-describedby={large?'diagram-desc-large':'diagram-desc'}
  >
    <title id={large?'diagram-title-large':'diagram-title'}>Webhook delivery architecture</title>
    <desc id={large?'diagram-desc-large':'diagram-desc'}>
      Product services write events to an outbox. A relay publishes delivery jobs. Workers claim
      jobs, sign requests, call customer endpoints, and persist success, retry, or dead-letter
      outcomes. Operators can inspect and replay dead-lettered deliveries.
    </desc>
    <defs>
      <marker
        id={large?'arrow-large':'arrow'}
        viewBox="0 0 10 10"
        refX="9"
        refY="5"
        markerWidth="7"
        markerHeight="7"
        orient="auto-start-reverse"
      >
        <path d="M0 0 10 5 0 10z" fill="#3158b6" />
      </marker>
    </defs>
    <rect x="25" y="160" width="145" height="76" rx="8" class="diagram-box" />
    <text x="97" y="190" text-anchor="middle" class="diagram-title">Product service</text>
    <text x="97" y="214" text-anchor="middle">creates domain event</text>
    <rect x="225" y="70" width="170" height="105" rx="8" class="diagram-box strong" />
    <text x="310" y="103" text-anchor="middle" class="diagram-title">Event + outbox</text>
    <text x="310" y="128" text-anchor="middle">same DB transaction</text>
    <text x="310" y="151" text-anchor="middle">stable event_id</text>
    <rect x="225" y="245" width="170" height="92" rx="8" class="diagram-box" />
    <text x="310" y="278" text-anchor="middle" class="diagram-title">Relay + queue</text>
    <text x="310" y="303" text-anchor="middle">one job / endpoint</text>
    <rect x="470" y="145" width="165" height="105" rx="8" class="diagram-box strong" />
    <text x="552" y="178" text-anchor="middle" class="diagram-title">Delivery worker</text>
    <text x="552" y="203" text-anchor="middle">claim · sign · send</text>
    <text x="552" y="226" text-anchor="middle">persist outcome</text>
    <rect x="720" y="62" width="170" height="92" rx="8" class="diagram-box" />
    <text x="805" y="95" text-anchor="middle" class="diagram-title">Customer endpoint</text>
    <text x="805" y="120" text-anchor="middle">2xx or failure</text>
    <rect x="720" y="255" width="170" height="100" rx="8" class="diagram-box" />
    <text x="805" y="288" text-anchor="middle" class="diagram-title">Delivery store</text>
    <text x="805" y="313" text-anchor="middle">attempts · next retry</text>
    <text x="805" y="336" text-anchor="middle">dead letter · replay</text>
    <path
      d="M170 198 C195 198 195 123 219 123"
      class="diagram-arrow"
      marker-end={`url(#${large?'arrow-large':'arrow'})`}
    />
    <path
      d="M310 175 V239"
      class="diagram-arrow"
      marker-end={`url(#${large?'arrow-large':'arrow'})`}
    />
    <path
      d="M395 291 C430 291 435 214 464 214"
      class="diagram-arrow"
      marker-end={`url(#${large?'arrow-large':'arrow'})`}
    />
    <path
      d="M635 180 C670 180 680 108 714 108"
      class="diagram-arrow"
      marker-end={`url(#${large?'arrow-large':'arrow'})`}
    />
    <path
      d="M805 154 V249"
      class="diagram-arrow"
      marker-end={`url(#${large?'arrow-large':'arrow'})`}
    />
    <path
      d="M635 225 C670 225 680 305 714 305"
      class="diagram-arrow"
      marker-end={`url(#${large?'arrow-large':'arrow'})`}
    />
    <path
      d="M720 335 C650 395 520 380 520 256"
      class="diagram-arrow dashed"
      marker-end={`url(#${large?'arrow-large':'arrow'})`}
    />
    <text x="615" y="394" text-anchor="middle">scheduled retry / manual replay</text>
  </svg>
{/snippet}

<div class="example-workspace-top">
  <a class="back-link" href="/">← Practice notebook</a>
  <div>
    <span class="eyebrow">WORKED EXAMPLE</span
    ><span class="example-readonly">Read-only · one good solution</span>
  </div>
</div>

<nav class="example-mobile-tabs" aria-label="Worked example view">
  <button type="button" class:active={mobileView==='brief'} onclick={showBrief}>
    Problem & questions
  </button>
  <button type="button" class:active={mobileView==='design'} onclick={showDesign}>
    Example design
  </button>
</nav>

<main class="example-workspace">
  <section
    class={mobileView === 'brief' ? 'example-brief-pane' : 'example-brief-pane mobile-hidden'}
    aria-label="Problem and example clarifications"
  >
    <div class="example-brief-content">
      <p class="eyebrow">EXAMPLE PROBLEM · NOT YOUR ACTIVE EXERCISE</p>
      <h1>Webhook<br>delivery</h1>
      <div class="brief-meta">
        <span>100k events / day</span><span>5k endpoints</span><span>at least once</span>
      </div>
      <p class="brief-text">
        Design a service where customers register HTTPS endpoints and product services send them
        event notifications. Events must be delivered at least once despite temporary failures.
        Customers need delivery status and a way to replay deliveries that exhausted automatic
        retries.
      </p>
      <div class="given-requirements">
        <h2>Given requirements</h2>
        <ul>
          <li>Customers can own several endpoints and subscribe each endpoint to event types.</li>
          <li>A successfully accepted product event must survive service restarts.</li>
          <li>Delivery payloads contain no secrets, but requests must be authenticated.</li>
        </ul>
      </div>
      <div class="deliverables">
        <h2>What to explain</h2>
        <ol>
          <li>Endpoint, event, delivery, and attempt data.</li>
          <li>Publish, retry, dead-letter, status, and replay flows.</li>
          <li>Duplicate, security, concurrency, and failure behavior.</li>
        </ol>
      </div>
      <section class="clarifications">
        <div class="row-between">
          <h2>Ask before you decide.</h2>
          <span class="small-note">3 strong questions</span>
        </div>
        <p class="small-note">
          These questions determine correctness and the shape of stored state.
        </p>
        <div class="clarification-exchange">
          <div class="chat-message learner">
            <span class="eyebrow">YOUR QUESTION</span>
            <p>Does at least once permit duplicates, and do endpoints need events in order?</p>
          </div>
          <div class="chat-message">
            <span class="eyebrow">GUIDE ANSWER</span>
            <p>
              Duplicates are allowed, so every payload needs a stable event ID. Ordering is not
              guaranteed; consumers must tolerate independent delivery.
            </p>
          </div>
        </div>
        <div class="clarification-exchange">
          <div class="chat-message learner">
            <span class="eyebrow">YOUR QUESTION</span>
            <p>What counts as success, and how long should automatic retry continue?</p>
          </div>
          <div class="chat-message">
            <span class="eyebrow">GUIDE ANSWER</span>
            <p>
              Any 2xx response succeeds. Retry timeouts, network failures, 408, 429, and 5xx with
              exponential backoff and jitter for 24 hours; other 4xx responses are terminal.
            </p>
          </div>
        </div>
        <div class="clarification-exchange">
          <div class="chat-message learner">
            <span class="eyebrow">YOUR QUESTION</span>
            <p>How are requests authenticated, and what can a customer replay?</p>
          </div>
          <div class="chat-message">
            <span class="eyebrow">GUIDE ANSWER</span>
            <p>
              Each endpoint has a rotatable signing secret. Sign the timestamp and raw body. After
              retries end, retain the failed delivery for 30 days and allow an authorized customer
              to replay it.
            </p>
          </div>
        </div>
      </section>
      <details class="requirements" open>
        <summary>Clarified requirements</summary>
        <ul>
          <li>
            At least once permits duplicate attempts; event_id is stable across every attempt.
          </li>
          <li>No ordering guarantee is required.</li>
          <li>
            2xx succeeds; transient failures retry with exponential backoff and jitter for 24 hours.
          </li>
          <li>Sign timestamp + raw body; reject stale signatures and support secret rotation.</li>
          <li>Dead-lettered deliveries remain visible and replayable for 30 days.</li>
        </ul>
      </details>
    </div>
  </section>

  <div class="example-divider" aria-hidden="true"><span></span></div>

  <section
    class={mobileView === 'design' ? 'example-design-pane' : 'example-design-pane mobile-hidden'}
    aria-label="Complete example design"
  >
    <div class="example-editor-header">
      <div>
        <p class="eyebrow">EXAMPLE DESIGN</p>
        <p class="save-status">Read-only · not your attempt</p>
      </div>
      <span class="pill">One valid architecture</span>
    </div>
    <div class="example-editor-scroll">
      <article class="example-answer">
        <p class="example-guidance">
          This is where the learner writes. Aim for concrete stored facts, state transitions,
          ownership checks, and failure outcomes.
        </p>
        <h2>1 / Data model and ownership</h2>
        <p>
          <b>endpoints</b>(id, customer_id, url, enabled, active_secret_version, created_at). Only
          the owning customer can update, disable, inspect, or replay it. Secrets are encrypted at
          rest and never returned after creation.
        </p>
        <p>
          <b>subscriptions</b>(endpoint_id, event_type) has a unique pair. <b>events</b>(id, type,
          payload, occurred_at, created_at) stores the stable public event ID and immutable payload.
        </p>
        <p>
          <b>deliveries</b>(id, event_id, endpoint_id, status, attempt_count, next_attempt_at,
          last_http_status, last_error, succeeded_at, dead_lettered_at, replay_of). Unique
          <code>(event_id, endpoint_id)</code>
          prevents two logical deliveries. Index
          <code>(status, next_attempt_at)</code>
          finds due work.
        </p>
        <p>
          <b>delivery_attempts</b>(id, delivery_id, attempt_number, started_at, finished_at,
          http_status, error_class, response_time_ms) keeps an audit trail. Do not store arbitrary
          response bodies; they may contain customer secrets.
        </p>

        <h2>2 / Durable publication</h2>
        <p>
          A product transaction writes its business change and an outbox event together. A relay
          reads unsent outbox rows, inserts the immutable event, expands matching subscriptions into
          one delivery per endpoint, and publishes their IDs to the queue. It marks the outbox row
          relayed only after these durable rows exist. Reprocessing is safe because the event ID and
          event/endpoint pair are unique.
        </p>

        <h2>3 / Claim, sign, and deliver</h2>
        <ol>
          <li>
            A worker atomically claims a due delivery with a lease so only one live attempt is sent
            for it.
          </li>
          <li>
            Build a body containing <code>event_id</code>, type, occurrence time, and payload.
          </li>
          <li>
            Compute HMAC-SHA256 over <code>timestamp + "." + raw_body</code>. Send the timestamp,
            signature, event ID, and secret version in headers over HTTPS.
          </li>
          <li>Persist an attempt row and the delivery’s next state before releasing the lease.</li>
        </ol>
        <p>
          The receiver stores event_id before applying side effects, so a duplicate attempt can
          return 2xx without repeating work. The provider cannot guarantee exactly once across a
          network boundary; it gives customers the identifier needed for idempotency.
        </p>

        <h2>4 / Retry and terminal outcomes</h2>
        <p>
          A 2xx response marks the delivery succeeded. Network errors, timeouts, 408, 429, and 5xx
          schedule <code>min(base × 2^attempt, cap) + jitter</code>, honoring a reasonable
          Retry-After value. Other 4xx responses are terminal because the request itself is unlikely
          to improve.
        </p>
        <p>
          When the 24-hour retry window expires, mark the delivery dead-lettered. Status APIs list
          pending, retrying, succeeded, terminal, and dead-lettered deliveries with attempts and
          sanitized errors.
        </p>

        <h2>5 / Replay and recovery</h2>
        <p>
          An authorized customer can replay a terminal or dead-lettered delivery within 30 days.
          Create a new delivery row referencing the original; keep the same event_id so the
          receiver’s deduplication still works. A scheduler republishes due rows if a queue message
          is lost. Expired worker leases make crashed attempts claimable again, which may duplicate
          a request but cannot lose it.
        </p>

        <h2>6 / Security and operations</h2>
        <p>
          Require HTTPS, block private/link-local destinations after DNS resolution to limit SSRF,
          cap redirects and response size, and apply per-endpoint concurrency limits. Rotate secrets
          with a short overlap where both versions verify. Metrics cover queue age, success rate,
          retry reasons, endpoint latency, and dead-letter count.
        </p>

        <h2>7 / Architecture diagram</h2>
        <button
          class="example-diagram-preview"
          type="button"
          onclick={showDiagram}
          aria-label="Inspect webhook delivery architecture diagram"
        >
          {@render architectureDiagram()}
          <span>Inspect diagram ↗</span>
        </button>
        <p class="small-note">
          The outbox prevents accepted events from disappearing. Leases and retries favor recovery;
          stable IDs make the resulting duplicates manageable.
        </p>
        <aside class="example-takeaway">
          <p class="eyebrow">WHY THIS ANSWER IS EVALUATABLE</p>
          <p>
            It defines delivery states, retryable outcomes, the duplicate contract, signing input,
            crash recovery, ownership, and replay behavior. A different architecture is valid if it
            makes the same product guarantees explicit.
          </p>
        </aside>
      </article>
    </div>
  </section>
</main>

{#if diagramOpen}
  <div class="modal-backdrop image-modal">
    <dialog
      class="example-diagram-dialog"
      aria-label="Webhook delivery architecture diagram"
      use:openModal
      oncancel={hideDiagram}
    >
      <div class="row-between">
        <div>
          <p class="eyebrow">ARCHITECTURE DIAGRAM</p>
          <h2>One durable delivery design</h2>
        </div>
        <button type="button" class="quiet" onclick={hideDiagram} aria-label="Close diagram">
          ✕
        </button>
      </div>
      <div class="example-diagram-zoom">{@render architectureDiagram(true)}</div>
      <p class="small-note">
        Arrows show durable event creation, asynchronous delivery, recorded outcomes, and recovery
        paths.
      </p>
    </dialog>
  </div>
{/if}
