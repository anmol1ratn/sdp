<script lang="ts">
import type { MicTranscriber } from '@moonshine-ai/moonshine-wasm';
import { onDestroy } from 'svelte';

let {
  target,
  onupdate,
  disabled = false
}: {
  target: HTMLTextAreaElement | undefined;
  onupdate: (value: string) => void;
  disabled?: boolean;
} = $props();
let status = $state<'idle' | 'loading' | 'recording' | 'stopping'>('idle');
let progress = $state<number | null>(null);
let partial = $state('');
let message = $state('');
let mic: MicTranscriber | undefined;
let generation = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
async function start() {
  if (!target || disabled) return;
  const current = ++generation;
  const completed = new Set<string>();
  message = '';
  partial = '';
  if (
    !window.isSecureContext ||
    !window.crossOriginIsolated ||
    !navigator.mediaDevices?.getUserMedia ||
    typeof WebAssembly === 'undefined'
  ) {
    message =
      'Local dictation is unavailable in this browser or page configuration. You can keep typing.';
    return;
  }
  status = 'loading';
  progress = null;
  let instance: MicTranscriber | undefined;
  try {
    const moduleUrl = '/voice/moonshine/index.js';
    const voice = (await import(
      /* @vite-ignore */ moduleUrl
    )) as typeof import('@moonshine-ai/moonshine-wasm');
    if (current !== generation) return;
    instance = new voice.MicTranscriber()
      .language('en')
      .modelArch(voice.ModelArch.MediumStreaming)
      .onProgress((fraction, _file, bytes) => {
        if (current === generation) progress = bytes?.total ? Math.round(fraction * 100) : null;
      })
      .onText((text) => {
        if (current === generation) partial = text;
      })
      .onLine((line) => {
        if (current === generation) {
          if (completed.has(line.id)) return;
          completed.add(line.id);
          insertLine(line.text);
          partial = '';
        }
      })
      .onError(() => {
        if (current === generation)
          message =
            'The local speech model could not process this audio. Stop recording and continue typing.';
      });
    mic = instance;
    await instance.load();
    if (current !== generation) {
      instance.close();
      return;
    }
    await instance.start();
    if (current !== generation) {
      await instance.stop();
      instance.close();
      return;
    }
    status = 'recording';
    timer = setTimeout(() => void stop(), 120000);
  } catch {
    instance?.close();
    if (current === generation) {
      mic = undefined;
      status = 'idle';
      message =
        'Local dictation could not start. Check microphone permission and model download access, or keep typing.';
    }
  }
}
function insertLine(text: string) {
  const field = target;
  if (!field || !field.isConnected || field.disabled || disabled || !text.trim()) return;
  // Read the current value and selection, including edits made during recording.
  // Only completed lines enter the document; interim revisions never mutate it.
  const start = field.selectionStart,
    end = field.selectionEnd;
  const before = field.value.slice(0, start),
    after = field.value.slice(end);
  const insertion =
    (before && !/\s$/.test(before) ? ' ' : '') +
    text.trim() +
    (after && !/^[\s.,!?;:)]/.test(after) ? ' ' : '');
  if (
    field.maxLength >= 0 &&
    field.value.length - (end - start) + insertion.length > field.maxLength
  ) {
    message = 'Text limit reached. Shorten the text before continuing dictation.';
    return;
  }
  field.setRangeText(insertion, start, end, 'end');
  onupdate(field.value);
}
$effect(() => {
  if (disabled && status !== 'idle') cancel();
});
async function stop() {
  if (status !== 'recording') return;
  status = 'stopping';
  clearTimeout(timer);
  const instance = mic,
    current = generation;
  try {
    await instance?.stop();
  } catch {
    if (current === generation)
      message =
        'Recording stopped. Completed phrases are kept; unfinished speech could not be recovered.';
  } finally {
    instance?.close();
    if (current === generation) {
      mic = undefined;
      generation++;
      status = 'idle';
      partial = '';
    }
  }
}
function cancel() {
  generation++;
  clearTimeout(timer);
  const instance = mic;
  mic = undefined;
  void instance
    ?.stop()
    .catch(() => {})
    .finally(() => instance.close());
  partial = '';
  status = 'idle';
}
onDestroy(cancel);
</script>
<div class="dictation">
  {#if status==='idle'}
    <button
      type="button"
      class="quiet small"
      {disabled}
      onclick={start}
      title="Load English Moonshine Medium Streaming locally, then use your microphone"
    >
      ◉ Dictate
    </button>
  {/if}
  {#if status!=='idle'}
    <div class="dictation-panel">
      <div class="row-between">
        <strong
          >{status==='loading'?'Preparing local dictation':status==='recording'?'Recording on this device':'Finishing speech…'}</strong
        ><button type="button" class="quiet small" onclick={cancel}>Cancel</button>
      </div>
      {#if status==='loading'}
        <p>
          Loading English Moonshine Medium Streaming on demand. The first download is larger and may
          take a few minutes; later loads use the browser cache. Audio stays on this device.
        </p>
        <progress max="100" value={progress??undefined}></progress
        ><small>{progress===null?'Loading model…':`${progress}% downloaded`}</small>
      {:else if status==='recording'}
        <p class="small-note">Completed phrases appear at the text cursor. You can keep typing.</p>
        <p aria-live="polite" class="muted">{partial||'Listening…'}</p>
        <button type="button" onclick={stop}>Stop recording</button>
        <small
          >Stop finishes the current phrase. Cancel discards unfinished speech; text already added
          stays. Stops automatically after two minutes.</small
        >
      {:else}
        <p>Finishing the current phrase…</p>
      {/if}
    </div>
  {/if}
  {#if message}
    <p class="small-note" role="status">{message}</p>
  {/if}
</div>
