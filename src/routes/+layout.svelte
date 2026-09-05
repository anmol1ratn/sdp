<script lang="ts">
import '../app.css';

let { children } = $props();
</script>

<svelte:head>
  <title>Cloudflare SvelteKit Starter</title>
  <meta
    name="description"
    content="A lightweight, typed SvelteKit starter for Cloudflare Workers and D1."
  >
</svelte:head>

<div class="min-h-screen bg-slate-950 text-slate-100">
  <header class="border-b border-white/10">
    <nav
      class="mx-auto flex max-w-5xl items-center justify-between px-6 py-4"
      aria-label="Main navigation"
    >
      <a class="font-semibold tracking-tight text-white" href="/">Edge Starter</a>
      <div class="flex items-center gap-5 text-sm text-slate-300">
        <a class="transition hover:text-white" href="/about">About</a>
        <a
          class="rounded-full bg-white px-4 py-2 font-medium text-slate-950 transition hover:bg-cyan-200"
          href="/app"
        >
          Open app
        </a>
      </div>
    </nav>
  </header>

  {@render children()}
</div>
