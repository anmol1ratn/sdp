<svelte:head><title>Think through systems | Design Practice</title></svelte:head>
<main class="home-shell">
  <section class="home-intro">
    <p class="eyebrow">THE PRACTICE NOTEBOOK</p>
    <h1>Good systems begin<br>with good questions.</h1>
    <p class="lede">
      A little less memorizing architectures.<br>A little more thinking for yourself.
    </p>
  </section>
  <section class="home-grid" aria-label="Choose your next step">
    <a class="problem-card systems-card" href="/app"
      ><div class="card-top">
        <span class="eyebrow">PRACTICE LIBRARY</span><span class="pill">Choose your path</span>
      </div>
      <div
        class="system-map"
        role="img"
        aria-label="Clients send requests through an API service connected to a cache, queue, workers, and durable database."
      >
        <svg viewBox="0 0 680 210" aria-hidden="true">
          <defs>
            <marker
              id="flow-arrow"
              viewBox="0 0 8 8"
              refX="7"
              refY="4"
              markerWidth="6"
              markerHeight="6"
              orient="auto"
            >
              <path d="M0 0 8 4 0 8z"></path>
            </marker>
          </defs>
          <g class="flow-lines">
            <path d="M105 105H205"></path>
            <path d="M320 105H408"></path>
            <path d="M496 105H514V43H570"></path>
            <path d="M496 105H514V172.5H570"></path>
          </g>
          <g class="map-node clients">
            <rect x="20" y="72" width="86" height="66" rx="8"></rect>
            <text x="63" y="99">CLIENTS</text>
            <circle cx="48" cy="118" r="6"></circle>
            <circle cx="64" cy="118" r="6"></circle>
            <circle cx="80" cy="118" r="6"></circle>
          </g>
          <g class="map-node api">
            <rect x="205" y="61" width="116" height="88" rx="8"></rect>
            <text x="263" y="96">API</text>
            <text x="263" y="119">SERVICE</text>
          </g>
          <g class="map-node queue">
            <rect x="408" y="69" width="88" height="72" rx="8"></rect>
            <text x="452" y="99">QUEUE</text>
            <path d="M430 116h44M430 126h32"></path>
          </g>
          <g class="map-node satellite">
            <rect x="570" y="17" width="90" height="52" rx="8"></rect>
            <text x="615" y="48">CACHE</text>
          </g>
          <g class="map-node satellite">
            <path d="M570 151h90v43H570zM580 151v43M650 151v43"></path>
            <text x="615" y="178">DATA</text>
          </g>
          <text class="map-note" x="340" y="199">trace the request · protect the invariant</text>
        </svg>
      </div>
      <h2>Practice the decisions that hold a system together.</h2>
      <p>
        Clarify the promise, trace the request, choose the tradeoffs, and revise your reasoning.
      </p>
      <div class="card-bottom">
        <span>Data modeling · concurrency · caching · reliability</span
        ><strong>Browse problems ↗</strong>
      </div></a
    >
    <div class="side-stack">
      <a class="example-card" href="/example"
        ><span class="eyebrow">START HERE · 5 MIN READ</span>
        <h2>What does a good<br>answer look like?</h2>
        <p>
          Follow a small worked example, from an incomplete brief to a specific, reasoned design.
        </p>
        <strong>Read the example ↗</strong></a
      >
      <div class="pace-note">
        <div>
          <strong>Days, not deadlines.</strong>
          <p>
            Finish each problem within the recommended number of days. Come back to the same draft
            and make it better.
          </p>
        </div>
      </div>
    </div>
  </section>
  <section class="approach">
    <p class="eyebrow">A SMALL, DELIBERATE LOOP</p>
    <div>
      <p><b>01 / Clarify</b>Find the constraints that change your design.</p>
      <p><b>02 / Design</b>Explain what happens, and why it stays correct.</p>
      <p><b>03 / Revise</b>Use specific feedback. Keep every submitted attempt.</p>
    </div>
  </section>
</main>
