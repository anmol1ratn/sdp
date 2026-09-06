<script lang="ts">
import { onDestroy, onMount, tick, untrack } from 'svelte';
import { beforeNavigate, goto } from '$app/navigation';
import Dictation from '$lib/components/Dictation.svelte';
import ReviewCard from '$lib/components/ReviewCard.svelte';
import { compressImage } from '$lib/practice/client-images';
import {
  type Attachment,
  attemptNumber,
  type Submission,
  starterHeadings,
  type Workspace
} from '$lib/practice/types';

let {
  data
}: {
  data: {
    workspace: Workspace;
    user: { id: string };
  };
} = $props();
const initial = untrack(() => data);
let hydrated = $state(false);
let w = $state<Workspace>(initial.workspace);
let draft = $state(initial.workspace.state.draft);
let attachments = $state<Attachment[]>(initial.workspace.state.attachments);
let designOpen = $state(
  !!initial.workspace.state.draft ||
    initial.workspace.state.attachments.length > 0 ||
    !!initial.workspace.state.accepted
);
let focus = $state(false);
let mobileTab = $state<'brief' | 'design'>('brief');
let split = $state(40);
let dragging = $state(false);
let question = $state('');
let questionInput = $state<HTMLTextAreaElement>();
let answerInput = $state<HTMLTextAreaElement>();
let challenge = $state('');
let challenging = $state(false);
let busy = $state(false);
let uploading = $state(false);
let saveLabel = $state('Saved');
let message = $state('');
let dirty = $state(false);
let historyOpen = $state(false);
let historyMode = $state<'browse' | 'compare'>('browse');
let selected = $state<string | null>(null);
let compareWith = $state<string | null>(null);
let zoom = $state<Attachment | null>(null);
let backup = $state<{ draft: string; attachments: Attachment[] } | null>(null);
let saveTimer: ReturnType<typeof setTimeout> | undefined;
let savePromise: Promise<void> | null = null;
let container: HTMLDivElement;
let historyDialog = $state<HTMLDialogElement>();
let fileInput = $state<HTMLInputElement>();
let openDesignButton = $state<HTMLButtonElement>();
const stage = initial.workspace.state.stage;
const problem = initial.workspace.problem;
const stageDefinition = problem.stages.find((item) => item.id === stage)!;
const unlockedOrder =
  problem.stages.find((item) => item.id === initial.workspace.unlocked)?.order ?? 1;
const nextStage = problem.stages.find((item) => item.order === stageDefinition.order + 1);
let latest = $derived(w.submissions.filter((s) => s.stage === stage).at(-1));
let chosen = $derived(
  w.submissions.find((s) => s.id === selected) ?? latest ?? w.submissions.at(-1)
);
let comparisonChoices = $derived(chosen ? w.submissions.filter((s) => s.id !== chosen.id) : []);
let comparisonAttempt = $derived(
  comparisonChoices.find((s) => s.id === compareWith) ?? comparisonChoices.at(-1)
);
let latestReview = $derived(latest?.reviews.at(-1));
let acceptedSubmission = $derived(w.submissions.find((s) => s.id === w.state.accepted));
let shownAttachments = $derived(acceptedSubmission?.attachments ?? attachments);
let stageAttempts = $derived(w.submissions.filter((submission) => submission.stage === stage));
const key = `design-practice-backup:${initial.user.id}:${problem.id}:${stage}`;
let clarifiedRules = $derived(
  w.rules.filter((rule) => !stageDefinition.publicRules.some((given) => given.id === rule.id))
);
async function focusHistoryMode() {
  await tick();
  const selector =
    historyMode === 'compare' ? '.comparison-selectors select' : '.attempt-pills .active';
  historyDialog?.querySelector<HTMLElement>(selector)?.focus();
}
async function openHistory(mode: 'browse' | 'compare') {
  historyMode = mode;
  selected = chosen?.id ?? null;
  compareWith = null;
  historyOpen = true;
  await focusHistoryMode();
}
async function setHistoryMode(mode: 'browse' | 'compare') {
  historyMode = mode;
  if (mode === 'compare') compareWith = null;
  await focusHistoryMode();
}
function preserve() {
  try {
    localStorage.setItem(key, JSON.stringify({ draft, attachments }));
  } catch {}
}
function changed() {
  dirty = true;
  saveLabel = 'Unsaved';
  preserve();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => void save().catch(() => {}), 900);
}
async function api(payload: unknown): Promise<Workspace> {
  const response = await fetch('/api/practice', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ problem: problem.id, ...(payload as object) })
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.message ?? 'The request did not finish. Your draft is retained.');
  return result;
}
async function save(): Promise<void> {
  clearTimeout(saveTimer);
  if (savePromise) {
    await savePromise;
    if (dirty) return save();
    return;
  }
  if (!dirty || busy || w.state.accepted) return;
  const text = draft,
    ids = attachments.map((a) => a.id);
  saveLabel = 'Saving…';
  savePromise = (async () => {
    try {
      const result = await api({
        action: 'save',
        stage,
        version: w.version,
        draft: text,
        attachments: ids
      });
      w = result;
      if (draft === text && attachments.map((a) => a.id).join() === ids.join()) {
        dirty = false;
        saveLabel = 'Saved';
        localStorage.removeItem(key);
      } else saveLabel = 'Unsaved';
    } catch (e) {
      saveLabel = 'Not saved';
      message = e instanceof Error ? e.message : 'Saving failed.';
      throw e;
    }
  })();
  try {
    await savePromise;
  } finally {
    savePromise = null;
  }
}
async function act(action: 'clarify' | 'review' | 'challenge') {
  message = '';
  try {
    await save();
  } catch {
    return;
  }
  busy = true;
  try {
    w = await api({
      action,
      stage,
      version: w.version,
      requestId: crypto.randomUUID(),
      text: action === 'challenge' ? challenge : question,
      submissionId: action === 'challenge' ? latest?.id : undefined
    });
    if (action === 'clarify') question = '';
    if (action === 'challenge') {
      challenge = '';
      challenging = false;
    }
    if (action !== 'clarify') {
      designOpen = true;
      mobileTab = 'design';
    }
    if (w.state.accepted) saveLabel = 'Accepted · preserved';
  } catch (e) {
    message = e instanceof Error ? e.message : 'The request failed.';
  } finally {
    busy = false;
  }
}
async function upload(event: Event) {
  const input = event.target as HTMLInputElement;
  const files = Array.from(input.files ?? []);
  input.value = '';
  if (files.length + attachments.length > 2) {
    message = 'Attach up to two images per answer.';
    return;
  }
  uploading = true;
  message = '';
  try {
    for (const file of files) {
      const blob = await compressImage(file);
      const response = await fetch('/api/attachments', {
        method: 'POST',
        headers: {
          'Content-Type': blob.type,
          'x-file-name': encodeURIComponent(file.name),
          'x-problem-id': problem.id
        },
        body: blob
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? 'Upload failed.');
      attachments = [...attachments, result];
      changed();
    }
  } catch (e) {
    message = e instanceof Error ? e.message : 'The image could not be attached.';
  } finally {
    uploading = false;
  }
}
async function openDesign() {
  designOpen = true;
  mobileTab = 'design';
  await tick();
  answerInput?.focus();
}
async function closeDesign() {
  designOpen = false;
  mobileTab = 'brief';
  focus = false;
  await tick();
  openDesignButton?.focus();
}
async function followStage(event: MouseEvent, target: number) {
  if (!dirty || target === stage) return;
  event.preventDefault();
  message = '';
  try {
    await save();
    if (!dirty) await goto(`/app/practice/${problem.slug}?stage=${target}`);
  } catch {
    // save() keeps the local backup and exposes the actionable error.
  }
}
function move(event: PointerEvent) {
  if (!dragging) return;
  const rect = container.getBoundingClientRect();
  split = Math.max(28, Math.min(60, ((event.clientX - rect.left) / rect.width) * 100));
}
function resizeKey(event: KeyboardEvent) {
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault();
    split = Math.max(28, Math.min(60, split + (event.key === 'ArrowLeft' ? -2 : 2)));
  }
}
function openModal(node: HTMLDialogElement) {
  node.showModal();
  return {
    destroy() {
      node.close();
    }
  };
}
function unload(event: BeforeUnloadEvent) {
  if (dirty) {
    preserve();
    event.preventDefault();
  }
}
onMount(() => {
  hydrated = true;
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const value = JSON.parse(raw);
      if (
        value.draft !== draft ||
        JSON.stringify(value.attachments) !== JSON.stringify(attachments)
      )
        backup = value;
      else localStorage.removeItem(key);
    }
  } catch {}
  window.addEventListener('beforeunload', unload);
});
beforeNavigate(({ cancel }) => {
  if (dirty) {
    preserve();
    cancel();
    void save().catch(() => {});
    message = 'Your draft is being saved. Use the link again once saved.';
  }
});
onDestroy(() => {
  clearTimeout(saveTimer);
  if (typeof window !== 'undefined') window.removeEventListener('beforeunload', unload);
});
</script>
<svelte:head
  ><title>{problem.title} · Stage {stageDefinition.order} | Design Practice</title></svelte:head
>
<svelte:window onpointermove={move} onpointerup={()=>dragging=false} />
<fieldset class="workspace-controls" disabled={!hydrated}>
  <legend class="sr-only">Practice workspace</legend>
  <div class="workspace-top">
    <a class="back-link" href="/app">← My practice</a>
    <nav class="stage-tabs" aria-label="Practice stages">
      {#each problem.stages as item}
        {#if item.order <= unlockedOrder}
          <a
            class="stage-tab"
            class:current={stage===item.id}
            aria-current={stage===item.id?'step':undefined}
            href={`/app/practice/${problem.slug}?stage=${item.id}`}
            onclick={(event)=>followStage(event,item.id)}
            >{String(item.order).padStart(2, '0')} <span>{item.navTitle}</span></a
          >
        {:else}
          <span class="stage-tab locked" aria-disabled="true">
            {String(item.order).padStart(2, '0')} <span>Locked</span>
          </span>
        {/if}
      {/each}
    </nav>
    <button type="button" class="quiet small" onclick={()=>openHistory('browse')}>
      Attempts <span class="count">{stageAttempts.length}</span>
    </button>
  </div>
  {#if message}
    <div class="workspace-alert" role="alert">
      {message}
      <button
        type="button"
        class="quiet small"
        onclick={()=>message=''}
        aria-label="Dismiss message"
      >
        ×
      </button>
    </div>
  {/if}
  {#if backup&&!w.state.accepted}
    <div class="workspace-alert">
      There is an unsaved draft from this browser.<button
        type="button"
        onclick={()=>{draft=backup?.draft??draft;attachments=backup?.attachments??attachments;backup=null;designOpen=true;changed();}}
      >
        Recover draft
      </button><button
        type="button"
        class="quiet"
        onclick={()=>{backup=null;localStorage.removeItem(key);}}
      >
        Use saved draft
      </button>
    </div>
  {/if}
  <nav class="mobile-tabs" aria-label="Workspace view">
    <button type="button" class:active={mobileTab==='brief'} onclick={()=>mobileTab='brief'}>
      Brief & questions
    </button><button type="button" class:active={mobileTab==='design'} onclick={openDesign}>
      Your design
    </button>
  </nav>
  <div
    bind:this={container}
    class="workspace"
    class:writing={designOpen}
    class:focused={focus}
    class:dragging
    style={`--brief-width:${split}%`}
  >
    <section
      class="brief-pane"
      class:mobile-hidden={mobileTab!=='brief'}
      aria-label="Problem and clarifications"
    >
      <div class="brief-content">
        <p class="eyebrow">
          {problem.difficulty} <span class="dot">·</span> STAGE {stageDefinition.order} OF
          {problem.stages.length}
        </p>
        <h1>{problem.title}</h1>
        <div class="brief-meta">
          <span>Finish within {problem.pace}</span><span>{problem.focusSessions}</span>
          <span>{problem.prerequisites.join(' · ')}</span>
        </div>
        <p class="brief-text">{stageDefinition.brief}</p>
        <section class="given-requirements">
          <h2>Given requirements</h2>
          <ul>
            {#each stageDefinition.publicRules as rule}
              <li>{rule.text}</li>
            {/each}
          </ul>
        </section>
        {#if stageDefinition.order > 1}
          <div class="requirement-change">
            <p class="eyebrow">NEW STAGE</p>
            <h3>{stageDefinition.title}</h3>
            <p class="small-note">
              Your accepted earlier answer is preserved. This draft begins from that answer.
            </p>
          </div>
        {/if}
        <section class="deliverables">
          <h2>What to explain</h2>
          <ol>
            {#each stageDefinition.deliverables as item}
              <li>{item}</li>
            {/each}
          </ol>
          <p class="small-note">
            No production code or distributed deployment required. A specific, reasoned answer is
            enough. <a href="/example" target="_blank" rel="noreferrer">See an example ↗</a>
          </p>
        </section>
        <section class="clarifications">
          <div class="row-between">
            <h2>Ask before you decide.</h2>
            <span class="muted small-note">{w.state.exchanges} / 3 exchanges</span>
          </div>
          <p class="small-note">
            Ask related questions together, or state an assumption. You can keep asking after
            opening your design. After three exchanges, remaining current-stage rules are revealed.
          </p>
          {#each Array.from({length: Math.ceil(w.state.chat.length/2)}) as _, exchange}
            <section class="clarification-exchange" aria-label={`Clarification ${exchange+1}`}>
              {#each w.state.chat.slice(exchange*2, exchange*2+2) as chat}
                <article class="chat-message" class:learner={chat.role==='learner'}>
                  <span class="eyebrow"
                    >{chat.role==='learner'?'YOUR QUESTION':chat.correction?'GUIDE · CORRECTION':'GUIDE ANSWER'}</span
                  >
                  <p>{chat.text}</p>
                </article>
              {/each}
            </section>
          {/each}
          {#if clarifiedRules.length||w.state.assumptions.length}
            <details class="requirements" open>
              <summary>Clarified requirements</summary>
              <ul>
                {#each clarifiedRules as rule}
                  <li>{rule.text}</li>
                {/each}
              </ul>
              {#if w.state.assumptions.length}
                <h3>Accepted assumptions</h3>
                <ul>
                  {#each w.state.assumptions as assumption}
                    <li>{assumption}</li>
                  {/each}
                </ul>
              {/if}
              {#if w.state.revealed}
                <p class="assistance">
                  Requirements revealed · assistance recorded after three exchanges. This reveals
                  the brief, not a solution.
                </p>
              {/if}
            </details>
          {/if}
          {#if w.state.exchanges<3&&!w.state.accepted}
            <div class="question-composer">
              <label class="sr-only" for="question">Your clarification question</label
              ><textarea
                id="question"
                bind:this={questionInput}
                bind:value={question}
                maxlength="4000"
                rows="4"
                placeholder="What should happen if…? Can I assume…?"
                disabled={busy}
              ></textarea>
              <div class="composer-tools">
                <Dictation
                  disabled={busy}
                  target={questionInput}
                  onupdate={value=>question=value}
                />
                <button
                  type="button"
                  class="primary"
                  onclick={()=>act('clarify')}
                  disabled={busy||!question.trim()||uploading}
                >
                  {busy?'Working…':'Ask clarification ↑'}
                </button>
              </div>
            </div>
          {/if}
          {#if !w.aiReady}
            <p class="setup-note">
              Live clarification and review await AI setup. Your question and design remain
              available if a request cannot run.
            </p>
          {/if}
        </section>
        {#if !designOpen}
          <div class="continue-block">
            <button bind:this={openDesignButton} type="button" class="primary" onclick={openDesign}>
              Continue to design <span>→</span>
            </button>
            <p class="small-note">Questions are optional. Your brief and chat stay beside you.</p>
          </div>
        {/if}
      </div>
    </section>
    {#if designOpen}
      <div
        class="divider"
        role="slider"
        aria-label="Resize reading and writing panes"
        aria-orientation="horizontal"
        aria-valuenow={split}
        aria-valuemin="28"
        aria-valuemax="60"
        tabindex="0"
        onkeydown={resizeKey}
        onpointerdown={event=>{dragging=true;event.preventDefault();}}
      >
        <span></span>
      </div>
      <section
        class="design-pane"
        class:mobile-hidden={mobileTab!=='design'}
        aria-label="Your design"
      >
        <div class="editor-header">
          <div>
            <p class="eyebrow">YOUR DESIGN</p>
            <p class="save-status" aria-live="polite">
              {w.state.accepted?'Accepted · preserved':saveLabel}
            </p>
          </div>
          <div class="editor-actions">
            <button type="button" class="quiet small" onclick={closeDesign}>Close design</button>
            <button type="button" class="quiet small focus-toggle" onclick={()=>focus=!focus}>
              {focus?'Show brief ↙':'Focus editor ↗'}
            </button>
          </div>
        </div>
        <div class="editor-scroll">
          <div class="editor-paper">
            <div class="editor-help">
              <span>Write in plain text or Markdown.</span>
              {#if !draft&&!w.state.accepted}
                <button
                  type="button"
                  class="text-button"
                  onclick={()=>{draft=starterHeadings;changed();}}
                >
                  Add starter headings
                </button>
              {/if}
            </div>
            {#if acceptedSubmission}
              <pre
                class="accepted-answer"
              >{acceptedSubmission.answer || '(Diagram submission)'}</pre>
            {:else}
              <label class="sr-only" for="answer">Your system design answer</label
              ><textarea
                class="answer-editor"
                id="answer"
                bind:this={answerInput}
                bind:value={draft}
                oninput={changed}
                disabled={busy||!!w.state.accepted}
                maxlength="24000"
                placeholder="Explain the data you store, what happens on each request, and why it stays correct.\n\nStart with the part you understand. You can revise as you go."
              ></textarea>
            {/if}
            {#if shownAttachments.length}
              <div class="attachments">
                {#each shownAttachments as attachment}
                  <figure>
                    <button type="button" class="image-preview" onclick={()=>zoom=attachment}>
                      <img src={'/api/attachments/'+attachment.id} alt={attachment.name}>
                      <span>Inspect image ↗</span>
                    </button>
                    <figcaption>
                      <span>{attachment.name}</span>
                      {#if !w.state.accepted}
                        <button
                          type="button"
                          class="quiet small"
                          disabled={busy}
                          onclick={()=>{attachments=attachments.filter(a=>a.id!==attachment.id);changed();}}
                          aria-label={'Remove '+attachment.name}
                        >
                          ×
                        </button>
                      {/if}
                    </figcaption>
                  </figure>
                {/each}
              </div>
            {/if}
            {#if !w.state.accepted}
              <div class="attachment-tools">
                <input
                  class="sr-only"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  multiple
                  bind:this={fileInput}
                  onchange={upload}
                ><button
                  type="button"
                  class="quiet small"
                  onclick={()=>fileInput?.click()}
                  disabled={busy||uploading||attachments.length>=2||!w.attachmentsReady}
                >
                  {uploading?'Preparing image…':'＋ Attach diagram'}
                </button><Dictation
                  disabled={busy}
                  target={answerInput}
                  onupdate={value=>{draft=value;changed();}}
                /><span class="small-note">{attachments.length}/2 images</span>
              </div>
              <p class="image-note">
                Photos and handwritten notes welcome. Up to 10 MiB each; resized to 2000px / 2 MiB.
                Inspect labels before submitting.
                {w.attachmentsReady?'':'Image storage is not configured yet.'}
              </p>
            {/if}
          </div>
          {#if latestReview}
            <div class="feedback-section">
              <p class="eyebrow">
                STAGE {stage} · ATTEMPT {latest ? attemptNumber(w.submissions,latest) : 1} REVIEW
              </p>
              <ReviewCard review={latestReview.review} />
              {#if !w.state.accepted}
                <button
                  type="button"
                  class="text-button"
                  disabled={busy||w.state.challenges>=2}
                  onclick={()=>challenging=!challenging}
                >
                  Question this feedback ({w.state.challenges}/2 used)
                </button>
                {#if challenging}
                  <div class="challenge-composer">
                    <label for="challenge"
                      >Point to the part of your submitted answer the reviewer missed.</label
                    ><textarea
                      id="challenge"
                      rows="3"
                      maxlength="4000"
                      bind:value={challenge}
                    ></textarea><button
                      type="button"
                      disabled={busy||!challenge.trim()}
                      onclick={()=>act('challenge')}
                    >
                      Recheck Stage {stage} · Attempt
                      {latest
                        ? attemptNumber(w.submissions,latest)
                        : 1}
                    </button>
                    <p class="small-note">
                      Rechecks use your AI allowance and preserve the original attempt and review.
                      New design changes belong in a new attempt.
                    </p>
                  </div>
                {/if}
              {:else if nextStage}
                <a
                  class="button primary"
                  href={`/app/practice/${problem.slug}?stage=${nextStage.id}`}
                  >Open stage {nextStage.order} →</a
                >
              {:else}
                <p class="completion-note">
                  All stages complete. Look back at your attempts to see what changed in your
                  reasoning.
                </p>
              {/if}
            </div>
          {/if}
        </div>
        <div class="editor-footer">
          <span class="small-note">{draft.length.toLocaleString()} / 24,000 characters</span>
          {#if !w.state.accepted}
            <button
              type="button"
              class="primary"
              disabled={busy||uploading||(!draft.trim()&&!attachments.length)}
              onclick={()=>act('review')}
            >
              {busy
                ? 'Reviewing…'
                : `Submit Stage ${stage} · Attempt ${stageAttempts.length+1} for review →`}
            </button>
          {:else}
            <button type="button" onclick={()=>openHistory('compare')}>Compare attempts →</button>
          {/if}
        </div>
      </section>
    {/if}
  </div>
  {#snippet attemptCard(attempt: Submission)}
    <article>
      <h3>Stage {attempt.stage} · Attempt {attemptNumber(w.submissions,attempt)}</h3>
      <p class="small-note">Submitted {new Date(attempt.created_at).toLocaleString()}</p>
      <pre>{attempt.answer||'(Diagram submission)'}</pre>
      {#if attempt.attachments.length}
        <div class="attachments">
          {#each attempt.attachments as image}
            <button type="button" class="image-preview" onclick={()=>zoom=image}>
              <img src={'/api/attachments/'+image.id} alt={image.name}>
            </button>
          {/each}
        </div>
      {/if}
      {#if attempt.reviews.length}
        <div class="attempt-review-history">
          <h4>Review history</h4>
          {#each attempt.reviews as review}
            <div class="history-review">
              {#if review.challenge}
                <p><b>Feedback challenged:</b> {review.challenge}</p>
              {/if}
              <ReviewCard review={review.review} />
            </div>
          {/each}
        </div>
      {/if}
    </article>
  {/snippet}
  {#if historyOpen}
    <div class="modal-backdrop">
      <dialog
        bind:this={historyDialog}
        class="history-modal"
        aria-label="Attempt history"
        use:openModal
        oncancel={()=>historyOpen=false}
      >
        <div class="row-between">
          <div>
            <p class="eyebrow" aria-live="polite">
              ATTEMPT HISTORY · {historyMode==='browse'?'BROWSE':'COMPARE'}
            </p>
            <h2>Your submitted thinking, preserved.</h2>
          </div>
          <button
            type="button"
            class="quiet"
            onclick={()=>historyOpen=false}
            aria-label="Close history"
          >
            ✕
          </button>
        </div>
        <p class="small-note history-intro">
          Attempts are numbered within each stage. Submitted answers never change; challenges add a
          new review beside the original attempt.
        </p>
        {#if !w.submissions.length}
          <p class="empty-state">No submitted attempts yet. Your draft is saved separately.</p>
        {:else}
          {#if chosen && historyMode==='browse'}
            <section class="attempt-browser" aria-label="Browse submitted attempts">
              {#each problem.stages.map((item) => item.id) as browserStage}
                {@const attempts = w.submissions.filter(sub=>sub.stage===browserStage)}
                {#if attempts.length}
                  <div class="attempt-group">
                    <span>Stage {browserStage}</span>
                    <div class="attempt-pills">
                      {#each attempts as sub}
                        <button
                          type="button"
                          class:active={chosen.id===sub.id}
                          aria-pressed={chosen.id===sub.id}
                          aria-label={`Stage ${sub.stage} · Attempt ${attemptNumber(w.submissions,sub)}`}
                          onclick={()=>selected=sub.id}
                        >
                          Attempt {attemptNumber(w.submissions,sub)}
                        </button>
                      {/each}
                    </div>
                  </div>
                {/if}
              {/each}
            </section>
            <div class="history-mode-actions">
              <button type="button" onclick={()=>setHistoryMode('compare')}>
                Compare attempts →
              </button>
            </div>
            <div class="comparison browse-attempt">
              {@render attemptCard(chosen)}
            </div>
          {:else if chosen}
            <div class="history-mode-actions">
              <button type="button" class="quiet" onclick={()=>setHistoryMode('browse')}>
                ← Back to single attempt
              </button>
            </div>
            <div class="comparison-selectors">
              <label>
                <span>First saved attempt</span>
                <select
                  aria-label="First saved attempt"
                  value={chosen.id}
                  onchange={(event)=>{selected=event.currentTarget.value;compareWith=null;}}
                >
                  {#each problem.stages.map((item) => item.id) as selectorStage}
                    {@const attempts = w.submissions.filter(sub=>sub.stage===selectorStage)}
                    {#if attempts.length}
                      <optgroup label={`Stage ${selectorStage}`}>
                        {#each attempts as sub}
                          <option value={sub.id}>
                            Stage {sub.stage} · Attempt {attemptNumber(w.submissions,sub)}
                          </option>
                        {/each}
                      </optgroup>
                    {/if}
                  {/each}
                </select>
              </label>
              <span class="comparison-relationship" aria-hidden="true">compared with</span>
              <label>
                <span>Second saved attempt</span>
                <select
                  aria-label="Second saved attempt"
                  value={comparisonAttempt?.id??''}
                  disabled={!comparisonChoices.length}
                  onchange={(event)=>compareWith=event.currentTarget.value}
                >
                  {#if !comparisonChoices.length}
                    <option value="">No other saved attempt</option>
                  {:else}
                    {#each problem.stages.map((item) => item.id) as selectorStage}
                      {@const attempts = comparisonChoices.filter(sub=>sub.stage===selectorStage)}
                      {#if attempts.length}
                        <optgroup label={`Stage ${selectorStage}`}>
                          {#each attempts as sub}
                            <option value={sub.id}>
                              Stage {sub.stage} · Attempt {attemptNumber(w.submissions,sub)}
                            </option>
                          {/each}
                        </optgroup>
                      {/if}
                    {/each}
                  {/if}
                </select>
              </label>
            </div>
            {#if !comparisonChoices.length}
              <p class="empty-state">
                Submit another attempt to compare two saved answers. Drafts do not count as
                attempts.
              </p>
            {/if}
            <div class="comparison" class:two={!!comparisonAttempt}>
              {#each [chosen,comparisonAttempt] as attempt}
                {#if attempt}
                  {@render attemptCard(attempt)}
                {/if}
              {/each}
            </div>
          {/if}
        {/if}
      </dialog>
    </div>
  {/if}
  {#if zoom}
    <div class="modal-backdrop image-modal">
      <dialog aria-label="Inspect attachment" use:openModal oncancel={()=>zoom=null}>
        <div class="row-between">
          <p>{zoom.name} · {zoom.width} × {zoom.height}</p>
          <button type="button" onclick={()=>zoom=null} aria-label="Close image">✕</button>
        </div>
        <div class="zoom-image"><img src={'/api/attachments/'+zoom.id} alt={zoom.name}></div>
        <p class="small-note">Shown at natural size. Scroll to inspect labels and arrows.</p>
      </dialog>
    </div>
  {/if}
</fieldset>
