<script lang="ts">
let { data, form } = $props();
</script>
<svelte:head><title>Sign in | Design Practice</title></svelte:head>
<main class="sign-in-shell">
  <p class="eyebrow">YOUR PRIVATE NOTEBOOK</p>
  <h1>Keep your thinking.</h1>
  <p class="lede">Sign in to save drafts, review your designs, and return to earlier attempts.</p>
  {#if form?.message}
    <p class="notice" role="alert">{form.message}</p>
  {/if}
  {#if data.configured}
    <form method="POST">
      <input type="hidden" name="next" value={data.next}>
      <button type="submit" class="primary">Continue with Google →</button>
    </form>
  {:else}
    <p class="notice">
      Sign-in is not configured yet. For local practice, run <code>pnpm dev:local</code>. The owner
      can configure Google sign-in before hosting.
    </p>
  {/if}
  <a class="back-link" href="/example">You can read the worked example now →</a>
</main>
