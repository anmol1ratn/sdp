<script lang="ts">
let { data, form } = $props();
</script>

<svelte:head><title>Your notes | Edge Starter</title></svelte:head>

<main class="mx-auto max-w-3xl px-6 py-16">
  <div class="flex flex-wrap items-start justify-between gap-5">
    <div>
      <p class="text-sm text-cyan-300">Signed in as {data.user.email}</p>
      <h1 class="mt-2 text-4xl font-semibold tracking-tight text-white">Your notes</h1>
    </div>
    <form method="POST" action="?/signout">
      <button
        class="rounded-full border border-white/20 px-4 py-2 text-sm font-medium text-white hover:border-white/40"
        type="submit"
      >
        Sign out
      </button>
    </form>
  </div>

  <form
    method="POST"
    action="?/create"
    class="mt-9 rounded-2xl border border-white/10 bg-white/[0.04] p-5"
  >
    <label for="body" class="text-sm font-medium text-slate-200">New note</label>
    <textarea
      id="body"
      name="body"
      rows="4"
      maxlength="5000"
      class="mt-3 w-full resize-y rounded-xl border border-white/15 bg-slate-900 p-4 text-white placeholder:text-slate-500"
      placeholder="What should you remember?"
      value={form?.action === 'create' && form?.body ? form.body : ''}
      required
    ></textarea>
    {#if form?.message}
      <p class="mt-3 text-sm text-red-300" role="alert">{form.message}</p>
    {/if}
    <div class="mt-4 flex justify-end">
      <button
        class="rounded-xl bg-cyan-300 px-5 py-2.5 font-semibold text-slate-950 hover:bg-cyan-200"
        type="submit"
      >
        Save note
      </button>
    </div>
  </form>

  <section class="mt-10" aria-labelledby="notes-heading">
    <h2 id="notes-heading" class="text-lg font-semibold text-white">Recent</h2>
    {#if data.notes.length === 0}
      <p
        class="mt-4 rounded-2xl border border-dashed border-white/15 p-8 text-center text-slate-400"
      >
        No notes yet. Add the first one above.
      </p>
    {:else}
      <ul class="mt-4 space-y-4">
        {#each data.notes as note (note.id)}
          <li class="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <p class="whitespace-pre-wrap text-slate-200">{note.body}</p>
            <div class="mt-4 flex items-center justify-between gap-4 text-xs text-slate-500">
              <time datetime={note.updatedAt.toISOString()}>{note.updatedAt.toLocaleString()}</time>
              <form method="POST" action="?/delete">
                <input type="hidden" name="id" value={note.id}>
                <button class="text-slate-400 hover:text-red-300" type="submit">Delete</button>
              </form>
            </div>
          </li>
        {/each}
      </ul>
    {/if}
  </section>
</main>
