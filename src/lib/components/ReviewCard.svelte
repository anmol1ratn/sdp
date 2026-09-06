<script lang="ts">
import type { Review } from '$lib/practice/types';

let { review }: { review: Review } = $props();
const labels = {
  accepted: 'Stage accepted',
  'needs-revision': 'Needs revision',
  'clarification-needed': 'Clarification needed'
};
</script>
<article class="review-card" class:accepted={review.verdict==='accepted'}>
  <p class="eyebrow">DESIGN REVIEW</p>
  <h3>{labels[review.verdict]}</h3>
  <p>{review.summary}</p>
  {#if review.strengths.length}
    <h4>What holds up</h4>
    <ul>
      {#each review.strengths as strength}
        <li>{strength}</li>
      {/each}
    </ul>
  {/if}
  {#each review.findings as finding}
    <div class="finding">
      <span class="finding-kind">{finding.kind.replaceAll('-',' ')}</span>
      <p>{finding.text}</p>
    </div>
  {/each}
  <p class="next-step"><b>Next step</b><br>{review.nextStep}</p>
</article>
