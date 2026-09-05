<svelte:head><title>Architecture | Edge Starter</title></svelte:head>

<main class="mx-auto max-w-3xl px-6 py-20">
  <p class="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">Architecture</p>
  <h1 class="mt-4 text-4xl font-semibold tracking-tight text-white">
    Deliberately boring in production.
  </h1>
  <div class="mt-8 space-y-6 text-lg leading-8 text-slate-300">
    <p>
      SvelteKit owns pages, form actions, API endpoints, and authentication routing. The Cloudflare
      adapter compiles the dynamic surface to one Worker while prerendered pages and build assets
      are served directly.
    </p>
    <p>
      D1 stores both application records and Better Auth sessions. Drizzle provides typed queries
      and generates reviewable SQL migrations. There is no second server, cache, queue, or paid
      database to operate.
    </p>
    <p>
      Start here while the product is small. Add infrastructure only after measurements show a real
      constraint.
    </p>
  </div>
</main>
