<main class="mx-auto grid max-w-5xl gap-14 px-6 py-20 md:grid-cols-[1.25fr_0.75fr] md:py-28">
  <section>
    <p class="mb-5 text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">
      Small app, solid foundation
    </p>
    <h1 class="max-w-3xl text-5xl font-semibold tracking-tight text-white md:text-7xl">
      Ship the useful thing, not the infrastructure diagram.
    </h1>
    <p class="mt-7 max-w-2xl text-lg leading-8 text-slate-300">
      Svelte 5, SvelteKit, D1, Better Auth, Drizzle, and strict TypeScript in one Cloudflare Worker.
      Public pages prerender; authenticated work stays server-side.
    </p>
    <div class="mt-10 flex flex-wrap gap-4">
      <a
        class="rounded-full bg-cyan-300 px-6 py-3 font-semibold text-slate-950 transition hover:bg-cyan-200"
        href="/app"
      >
        Try the protected app
      </a>
      <a
        class="rounded-full border border-white/20 px-6 py-3 font-semibold text-white transition hover:border-white/40"
        href="/about"
      >
        See the architecture
      </a>
    </div>
  </section>

  <aside
    class="rounded-3xl border border-white/10 bg-white/[0.04] p-7 shadow-2xl shadow-cyan-950/30"
  >
    <p class="text-sm font-medium text-cyan-300">Included by default</p>
    <ul class="mt-5 space-y-4 text-sm leading-6 text-slate-300">
      <li><strong class="text-white">One deploy:</strong> no API service or monorepo ceremony.</li>
      <li>
        <strong class="text-white">One database:</strong>
        typed app and authentication data in D1.
      </li>
      <li>
        <strong class="text-white">One auth path:</strong>
        Google OAuth with server-owned secure cookies.
      </li>
      <li>
        <strong class="text-white">Zero-dollar target:</strong>
        designed for modest, low-frequency use.
      </li>
    </ul>
  </aside>
</main>
