import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';

test('dictation writes stable phrases directly, preserves edits, cancels safely and autosaves', async ({
  page
}) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      throw new Error('Real microphone forbidden in this test');
    };
  });
  await page.route('**/voice/moonshine/index.js*', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: `export const ModelArch = { MediumStreaming: 5 };
      export class MicTranscriber {
        constructor() { window.voice = this; }
        language() { return this; } modelArch(arch) { if (arch !== 5) throw new Error('Expected Medium Streaming'); return this; }
        onProgress(fn) { return this; } onText(fn) { this.text = fn; return this; }
        onLine(fn) { this.line = fn; return this; } onError(fn) { return this; }
        async load() {} async start() {}
        async stop() { this.line({id: 'stop', text: 'finished'}); }
        close() {}
      }`
    })
  );
  await page.setExtraHTTPHeaders({ 'x-test-user-id': `test-${randomUUID()}` });
  await page.goto('/app/practice/meeting-room');
  await page.getByRole('button', { name: 'Continue to design' }).click();
  const editor = page.getByLabel('Your system design answer');
  await editor.fill('Before replace after');
  await editor.evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(7, 14));
  await page.locator('.attachment-tools').getByRole('button', { name: 'Dictate' }).click();
  await expect(page.getByText('Recording on this device')).toBeVisible();
  const emit = async (kind: 'text' | 'line', text: string, id = 'one') => {
    await page.evaluate(
      ({ kind, text, id }) => {
        const voice = (
          window as unknown as {
            voice: { text: (s: string) => void; line: (l: { id: string; text: string }) => void };
          }
        ).voice;
        if (kind === 'text') voice.text(text);
        else voice.line({ id, text });
      },
      { kind, text, id }
    );
  };
  await emit('text', 'wrong');
  await emit('text', 'corrected');
  await expect(editor).toHaveValue('Before replace after');
  await emit('line', 'corrected');
  await emit('line', 'corrected');
  await expect(editor).toHaveValue('Before corrected after');
  await editor.fill('My edited draft.');
  await emit('text', 'revising');
  await emit('line', 'next phrase', 'two');
  await expect(editor).toHaveValue('My edited draft. next phrase');
  await page.getByRole('button', { name: 'Stop recording', exact: true }).click();
  await expect(editor).toHaveValue('My edited draft. next phrase finished');
  await emit('line', 'late event', 'late');
  await expect(editor).toHaveValue('My edited draft. next phrase finished');
  await expect(page.getByLabel('Dictation transcript')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Insert text' })).toHaveCount(0);
  await expect(page.locator('.save-status')).toHaveText('Saved');
  await page.reload();
  await expect(editor).toHaveValue('My edited draft. next phrase finished');
  const question = page.getByLabel('Your clarification question');
  await question.fill('Can we');
  await page.locator('.composer-tools').getByRole('button', { name: 'Dictate' }).click();
  await expect(page.getByText('Recording on this device')).toBeVisible();
  await emit('line', 'retry?', 'question');
  await emit('text', 'discard me');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await emit('line', 'also discard', 'late');
  await expect(question).toHaveValue('Can we retry?');
  await expect(page.getByRole('button', { name: 'Ask clarification ↑' })).toBeEnabled();
  await expect(page.locator('.chat-message')).toHaveCount(0);
});
