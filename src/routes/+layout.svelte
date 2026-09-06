<script lang="ts">
import '../app.css';

let { children } = $props();
</script>
<svelte:head
  ><title>Design Practice</title>
  <meta
    name="description"
    content="Work through real system-design problems. Ask good questions, explain your decisions, and improve through revision."
  ></svelte:head
>
<header class="site-header">
  <a class="brand" href="/"
    ><span class="brand-symbol" aria-hidden="true">d<span>p</span></span>Design Practice</a
  >
  <nav aria-label="Main navigation">
    <a href="/example">Worked example</a
    ><a href="/app">My practice <span aria-hidden="true">↗</span></a>
  </nav>
</header>
{@render children()}
