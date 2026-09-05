<script lang="ts">
let { data, form } = $props();
</script>

<svelte:head><title>Sign in | Edge Starter</title></svelte:head>

<main class="mx-auto flex max-w-lg flex-col px-6 py-20">
  <div class="rounded-3xl border border-white/10 bg-white/[0.04] p-8">
    <p class="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">Protected area</p>
    <h1 class="mt-3 text-3xl font-semibold text-white">Sign in to continue</h1>
    <p class="mt-3 leading-7 text-slate-300">
      Google OAuth is the only method enabled in this starter, keeping the free-tier runtime light
      and avoiding a transactional email dependency.
    </p>

    {#if form?.message}
      <p
        class="mt-5 rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200"
        role="alert"
      >
        {form.message}
      </p>
    {/if}

    <form method="POST" class="mt-7">
      <input type="hidden" name="next" value={data.next}>
      <button
        class="w-full rounded-xl bg-white px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-200"
        type="submit"
      >
        Continue with Google
      </button>
    </form>
  </div>
</main>
