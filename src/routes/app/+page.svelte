<script lang="ts">
import { onMount } from 'svelte';
import type { ProblemSummary } from '$lib/practice/types';

let { data } = $props();
let hydrated = $state(false);
let query = $state('');
let difficulty = $state('all');
let selectedTopic = $state('all');
let statusFilter = $state('all');
let days = $state('all');

const attempts = (problem: ProblemSummary) =>
  Object.values(problem.attemptCounts).reduce((sum, count) => sum + count, 0);
const status = (problem: ProblemSummary) =>
  problem.acceptedStages.length === problem.stages.length
    ? 'completed'
    : problem.hasDraft || attempts(problem) || problem.acceptedStages.length
      ? 'in-progress'
      : 'not-started';
const label = (value: string) =>
  value === 'completed' ? 'Completed' : value === 'in-progress' ? 'In progress' : 'Not started';
const href = (problem: ProblemSummary) => `/app/practice/${problem.slug}?stage=${problem.unlocked}`;

let ordered = $derived([...data.problems].sort((a, b) => a.curriculumOrder - b.curriculumOrder));
let topics = $derived([...new Set(ordered.flatMap((problem) => problem.topics))].sort());
let active = $derived(
  ordered.find((problem) => status(problem) === 'in-progress') ??
    ordered.find((problem) => status(problem) === 'not-started') ??
    ordered[0]
);
let returning = $derived(active ? status(active) === 'in-progress' : false);
let hasHistory = $derived(ordered.some((problem) => status(problem) !== 'not-started'));
let recommended = $derived(
  ordered.find((problem) => problem.id !== active?.id && status(problem) !== 'completed')
);
let filtered = $derived(
  ordered.filter((problem) => {
    const text = [problem.title, problem.summary, ...problem.topics, ...problem.prerequisites]
      .join(' ')
      .toLowerCase();
    return (
      text.includes(query.trim().toLowerCase()) &&
      (difficulty === 'all' || problem.difficulty === difficulty) &&
      (selectedTopic === 'all' || problem.topics.includes(selectedTopic)) &&
      (statusFilter === 'all' || status(problem) === statusFilter) &&
      (days === 'all' || problem.estimatedDays === Number(days))
    );
  })
);
function resetFilters() {
  query = '';
  difficulty = 'all';
  selectedTopic = 'all';
  statusFilter = 'all';
  days = 'all';
}
onMount(() => {
  hydrated = true;
});
</script>

<svelte:head><title>My practice | Design Practice</title></svelte:head>
<main class="home-shell practice-dashboard">
  <section class="home-intro compact">
    <p class="eyebrow">YOUR NOTEBOOK</p>
    <h1>Pick up the thread.</h1>
    <p class="lede">
      A growing library of focused system-design problems. Every revision stays yours.
    </p>
  </section>

  {#if active}
    <section class="continue-card" aria-labelledby="continue-heading">
      <div>
        <p class="eyebrow">
          {returning
            ? 'CONTINUE WHERE YOU LEFT OFF'
            : hasHistory
              ? 'START YOUR NEXT PROBLEM'
              : 'START YOUR FIRST PROBLEM'}
        </p>
        <h2 id="continue-heading">{active.title}</h2>
        <p>{active.summary}</p>
      </div>
      <div class="continue-meta">
        <span class="difficulty-badge inverse">{active.difficulty}</span>
        <strong>Stage {active.unlocked} of {active.stages.length}</strong>
        <span>Finish within {active.pace}</span>
        <a class="button primary" href={href(active)}
          >{returning ? 'Continue' : 'Start'}
          stage {active.unlocked} →</a
        >
      </div>
    </section>
  {/if}

  <section class="recommended-row" aria-labelledby="recommended-heading">
    <div>
      <p class="eyebrow">RECOMMENDED NEXT</p>
      <div class="recommended-title">
        <h2 id="recommended-heading">
          {recommended ? recommended.title : 'You have completed the current library.'}
        </h2>
        {#if recommended}
          <span class="difficulty-badge">{recommended.difficulty}</span>
        {/if}
      </div>
      <p>
        {recommended ? `Next in curriculum order after your active problem. It builds on ${recommended.prerequisites.join(' and ')}.` : 'Revisit your attempt history or compare how your reasoning changed.'}
      </p>
    </div>
    {#if recommended}
      <a href={href(recommended)}>Preview problem ↗</a>
    {:else}
      <a href="/example">Review the worked example ↗</a>
    {/if}
  </section>

  <section class="library" aria-labelledby="library-heading">
    <div class="library-heading">
      <div>
        <p class="eyebrow">PROBLEM LIBRARY</p>
        <h2 id="library-heading">Find the right practice.</h2>
      </div>
      <span aria-live="polite">{filtered.length} of {ordered.length} problems</span>
    </div>
    <fieldset class="library-controls" disabled={!hydrated}>
      <legend class="sr-only">Filter problem library</legend>
      <label class="search-control"
        ><span>Search</span>
        <input
          bind:value={query}
          type="search"
          placeholder="Search titles, topics, prerequisites…"
        ></label
      >
      <label
        ><span>Difficulty</span
        ><select value={difficulty} oninput={(event) => difficulty = event.currentTarget.value}>
          <option value="all">All</option>
          {#each [...new Set(ordered.map((problem) => problem.difficulty))] as value}
            <option {value}>{value}</option>
          {/each}
        </select></label
      >
      <label
        ><span>Topic</span
        ><select
          value={selectedTopic}
          oninput={(event) => selectedTopic = event.currentTarget.value}
        >
          <option value="all">All</option>
          {#each topics as value}
            <option {value}>{value}</option>
          {/each}
        </select></label
      >
      <label
        ><span>Status</span
        ><select value={statusFilter} oninput={(event) => statusFilter = event.currentTarget.value}>
          <option value="all">All</option>
          <option value="not-started">Not started</option>
          <option value="in-progress">In progress</option>
          <option value="completed">Completed</option>
        </select></label
      >
      <label
        ><span>Estimated time</span
        ><select value={days} oninput={(event) => days = event.currentTarget.value}>
          <option value="all">All days</option>
          {#each [...new Set(ordered.map((problem) => problem.estimatedDays))].sort() as value}
            <option value={String(value)}>{value} days</option>
          {/each}
        </select></label
      >
    </fieldset>

    {#if filtered.length}
      <div class="library-list">
        {#each filtered as problem}
          {@const problemStatus = status(problem)}
          {@const totalAttempts = attempts(problem)}
          <article class="library-card">
            <div class="library-card-main">
              <div class="card-top">
                <div class="card-badges">
                  <span class="pill status-pill">{label(problemStatus)}</span>
                  <span class="difficulty-badge">{problem.difficulty}</span>
                </div>
                <span class="pace-primary">Finish within <strong>{problem.pace}</strong></span>
              </div>
              <h3><a href={href(problem)}>{problem.title}</a></h3>
              <p>{problem.summary}</p>
              <ul class="topic-list" aria-label="Problem topics">
                {#each problem.topics as value}
                  <li>{value}</li>
                {/each}
              </ul>
            </div>
            <ol
              class="stage-track"
              style={`--stage-count:${problem.stages.length};--track-edge:${50 / problem.stages.length}%`}
              aria-label={`${problem.title} progress`}
            >
              {#each problem.stages as stage}
                <li
                  class:done={problem.acceptedStages.includes(stage.id)}
                  class:current={stage.id === problem.unlocked && problemStatus !== 'completed'}
                >
                  <span class="stage-marker">{stage.order}</span>
                  <span>{stage.order <= problem.unlocked ? stage.navTitle : 'Locked'}</span>
                </li>
              {/each}
            </ol>
            <div class="library-card-action">
              <span>{problem.focusSessions}</span>
              <span>{totalAttempts} {totalAttempts === 1 ? 'attempt' : 'attempts'}</span>
              <a href={href(problem)}
                >{problemStatus === 'not-started' ? 'Begin' : 'Open'}
                stage {problem.unlocked} →</a
              >
            </div>
          </article>
        {/each}
      </div>
    {:else}
      <div class="empty-library" role="status">
        <h3>No problems match these filters.</h3>
        <p>Clear the filters to see the full curriculum.</p>
        <button type="button" onclick={resetFilters}>Reset filters</button>
      </div>
    {/if}
  </section>

  <aside class="dashboard-reference">
    <a href="/example"
      ><span class="eyebrow">WORKED EXAMPLE</span
      ><strong>See what a concrete answer looks like ↗</strong></a
    >
  </aside>
</main>
