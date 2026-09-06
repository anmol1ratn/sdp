import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { PNG } from 'pngjs';

test.beforeEach(({ page }) => {
  page.on('pageerror', (error) => console.error('Browser error:', error.message));
  page.on('console', (m) => {
    if (m.type() === 'error') console.error('Console:', m.text());
  });
  page.on('requestfailed', (r) => console.error('Failed request:', r.url(), r.failure()));
});

test('home and worked example explain the real practice flow', async ({ page }) => {
  const writes: string[] = [];
  page.on('request', (request) => {
    if (request.method() !== 'GET') writes.push(`${request.method()} ${request.url()}`);
  });
  await page.goto('/');
  await expect(page).toHaveTitle('Think through systems | Design Practice');
  await expect(page.getByRole('heading', { name: /Good systems begin/ })).toBeVisible();
  await expect(
    page.getByText(/Finish each problem within the recommended number of days/)
  ).toBeVisible();
  await page.getByRole('link', { name: /Read the example/ }).click();
  await expect(page.getByRole('heading', { name: 'Webhook delivery' })).toBeVisible();
  await expect(page.getByText('EXAMPLE PROBLEM · NOT YOUR ACTIVE EXERCISE')).toBeVisible();
  await expect(page.getByText('Clarified requirements')).toBeVisible();
  await expect(page.getByRole('heading', { name: '1 / Data model and ownership' })).toBeVisible();
  await expect(page.getByText('Read-only · not your attempt')).toBeVisible();
  await expect(page.getByRole('textbox')).toHaveCount(0);
  await page.getByRole('button', { name: 'Inspect webhook delivery architecture diagram' }).click();
  const diagram = page.getByRole('dialog', { name: 'Webhook delivery architecture diagram' });
  await expect(diagram.getByRole('img', { name: 'Webhook delivery architecture' })).toBeVisible();
  await diagram.getByRole('button', { name: 'Close diagram' }).click();
  await expect(page.getByRole('link', { name: 'Open your practice' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'My practice' })).toHaveAttribute('href', '/app');
  expect(writes).toEqual([]);
});
test('worked example switches between readable panes on a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/example?view=mobile');
  await expect(page.getByLabel('Problem and example clarifications')).toBeVisible();
  await expect(page.getByLabel('Complete example design')).toBeHidden();
  await page.getByRole('button', { name: 'Example design' }).click();
  await expect(page.getByLabel('Complete example design')).toBeVisible();
  await expect(page.getByLabel('Problem and example clarifications')).toBeHidden();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
    )
  ).toBe(true);
  await page.getByRole('button', { name: 'Inspect webhook delivery architecture diagram' }).click();
  const diagram = page.getByRole('dialog', { name: 'Webhook delivery architecture diagram' });
  await expect(diagram).toBeVisible();
  await expect(diagram.locator('.example-diagram-zoom')).toHaveCSS('overflow-x', 'auto');
});
test('signed-out practice redirects to sign-in', async ({ page }) => {
  await page.goto('/app/practice/meeting-room');
  await expect(page).toHaveURL(/sign-in/);
});
test('legacy practice route keeps meeting-room stage links compatible', async ({ page }) => {
  await page.setExtraHTTPHeaders({ 'x-test-user-id': `test-${randomUUID()}` });
  await page.goto('/app/practice?stage=1');
  await expect(page).toHaveURL(/\/app\/practice\/meeting-room\?stage=1$/);
  await expect(page.getByRole('heading', { name: 'Meeting-room booking' })).toBeVisible();
});
test('dashboard lists every problem and keeps drafts isolated by problem', async ({ page }) => {
  await page.setExtraHTTPHeaders({ 'x-test-user-id': `test-${randomUUID()}` });
  await page.goto('/app');
  await expect(page.getByRole('link', { name: /Meeting-room booking/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /URL shortener/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Distributed rate limiter/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Meeting-room booking' }).first()).toBeVisible();
  await expect(page.getByText('Finish within 3 days').first()).toBeVisible();
  await expect(page.locator('.library-card').first().getByText('Intermediate')).toBeVisible();

  const tracks = page.locator('.stage-track');
  await expect(tracks).toHaveCount(3);
  for (const track of await tracks.all()) {
    const connectorCenterY = await track.evaluate((element) => {
      const trackBox = element.getBoundingClientRect();
      const connector = getComputedStyle(element, '::before');
      return (
        trackBox.top + Number.parseFloat(connector.top) + Number.parseFloat(connector.height) / 2
      );
    });
    const geometry = await track.locator('li').evaluateAll((items) =>
      items.map((item) => {
        const marker = item.querySelector('.stage-marker')?.getBoundingClientRect();
        const label = item.querySelector('.stage-marker + span')?.getBoundingClientRect();
        return marker && label
          ? { centerY: marker.top + marker.height / 2, clearance: label.top - marker.bottom }
          : null;
      })
    );
    expect(geometry.every((item) => item && item.clearance >= 6)).toBe(true);
    expect(new Set(geometry.map((item) => Math.round(item?.centerY ?? 0))).size).toBe(1);
    expect(geometry.every((item) => item && Math.abs(item.centerY - connectorCenterY) <= 0.1)).toBe(
      true
    );
  }

  await page.getByRole('combobox', { name: 'Topic' }).selectOption('Caching');
  await expect(page.locator('.library-card')).toHaveCount(1);
  await expect(
    page.locator('.library-card').getByRole('heading', { name: 'URL shortener' })
  ).toBeVisible();
  await page.getByLabel('Search').fill('no such architecture');
  await expect(
    page.getByRole('heading', { name: 'No problems match these filters.' })
  ).toBeVisible();
  await page.getByRole('button', { name: 'Reset filters' }).click();
  await expect(page.locator('.library-card')).toHaveCount(3);
  await page.getByRole('combobox', { name: 'Status' }).selectOption('not-started');
  await expect(page.locator('.library-card')).toHaveCount(3);
  await page.getByRole('combobox', { name: 'Estimated time' }).selectOption('4');
  await expect(page.getByRole('combobox', { name: 'Estimated time' })).toHaveValue('4');
  await expect(
    page.getByRole('combobox', { name: 'Estimated time' }).locator('option:checked')
  ).toHaveText('4 days');
  await expect(page.locator('.library-card')).toHaveCount(1);

  await page.goto('/app/practice/url-shortener?stage=1');
  await expect(page.getByText('02 Locked')).toBeVisible();
  await expect(page.getByText('03 Locked')).toBeVisible();
  await page.getByRole('button', { name: 'Continue to design' }).click();
  await page.getByLabel('Your system design answer').fill('URL-specific draft');
  await expect(page.locator('.save-status')).toHaveText('Saved');

  await page.goto('/app/practice/rate-limiter?stage=1');
  await page.getByRole('button', { name: 'Continue to design' }).click();
  await expect(page.getByLabel('Your system design answer')).toHaveValue('');
  await expect(page.getByRole('heading', { name: 'Distributed rate limiter' })).toBeVisible();
});
test('dashboard library and empty state fit a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.setExtraHTTPHeaders({ 'x-test-user-id': `test-${randomUUID()}` });
  await page.goto('/app');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
    )
  ).toBe(true);
  await page.getByLabel('Search').fill('nothing matches this');
  await expect(page.getByRole('button', { name: 'Reset filters' })).toBeVisible();
  await page.getByRole('button', { name: 'Reset filters' }).click();
  await expect(page.locator('.library-card')).toHaveCount(3);
  for (const track of await page.locator('.stage-track').all()) {
    const centers = await track.evaluate((element) => {
      const trackBox = element.getBoundingClientRect();
      const connector = getComputedStyle(element, '::before');
      const connectorCenter =
        trackBox.top + Number.parseFloat(connector.top) + Number.parseFloat(connector.height) / 2;
      const markerCenters = Array.from(element.querySelectorAll('.stage-marker')).map((marker) => {
        const box = marker.getBoundingClientRect();
        return box.top + box.height / 2;
      });
      return { connectorCenter, markerCenters };
    });
    expect(
      centers.markerCenters.every((center) => Math.abs(center - centers.connectorCenter) <= 0.1)
    ).toBe(true);
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
    )
  ).toBe(true);
});
test('main surfaces fit a laptop viewport without horizontal clipping', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });

  for (const path of ['/', '/example']) {
    await page.goto(path);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
      )
    ).toBe(true);
  }

  await page.setExtraHTTPHeaders({ 'x-test-user-id': 'stage-navigation' });
  for (const path of ['/app', '/app/practice/meeting-room?stage=2']) {
    await page.goto(path);
    await expect(page.getByText(/Local development notebook/i)).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
      )
    ).toBe(true);
  }

  const workspace = page.locator('.workspace');
  const workspaceBox = await workspace.boundingBox();
  expect(workspaceBox).not.toBeNull();
  expect((workspaceBox?.y ?? 0) + (workspaceBox?.height ?? 0)).toBeLessThanOrEqual(900);
  expect((workspaceBox?.y ?? 0) + (workspaceBox?.height ?? 0)).toBeGreaterThanOrEqual(899);

  await page.getByRole('button', { name: 'Attempts 2' }).click();
  const history = page.getByRole('dialog', { name: 'Attempt history' });
  const historyBox = await history.boundingBox();
  expect(historyBox).not.toBeNull();
  expect(historyBox?.width ?? 1441).toBeLessThanOrEqual(1440);
  expect(historyBox?.height ?? 901).toBeLessThanOrEqual(900);
});
test('stage navigation preserves drafts and history numbers attempts within each stage', async ({
  page
}) => {
  await page.setExtraHTTPHeaders({ 'x-test-user-id': 'stage-navigation' });
  await page.goto('/app/practice/meeting-room?stage=2');
  await expect(page.getByRole('link', { name: '01 Core design' })).toHaveAttribute(
    'href',
    '/app/practice/meeting-room?stage=1'
  );
  await expect(page.getByRole('link', { name: '02 Requirement change' })).toHaveAttribute(
    'aria-current',
    'step'
  );
  await expect(page.getByRole('button', { name: 'Attempts 2' })).toBeVisible();

  await page.getByRole('button', { name: 'Attempts 2' }).click();
  const history = page.getByRole('dialog', { name: 'Attempt history' });
  await expect(history.getByLabel('First saved attempt')).toHaveCount(0);
  const stage2Pills = history.locator('.attempt-group').filter({ hasText: 'Stage 2' });
  await expect(stage2Pills.getByRole('button', { name: 'Attempt 2' })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  await expect(stage2Pills.getByRole('button', { name: 'Attempt 2' })).toBeFocused();
  await stage2Pills.getByRole('button', { name: 'Attempt 1' }).click();
  await expect(history.getByRole('heading', { name: 'Stage 2 · Attempt 1' })).toBeVisible();
  await expect(history.getByText('Stage 2 first answer', { exact: true })).toBeVisible();
  await expect(history.getByRole('heading', { name: 'Stage 2 · Attempt 2' })).toHaveCount(0);
  await stage2Pills.getByRole('button', { name: 'Attempt 2' }).click();
  await expect(history.getByText('Stage 2 latest review')).toBeVisible();

  await history.getByRole('button', { name: 'Compare attempts' }).click();
  const first = history.getByLabel('First saved attempt');
  const second = history.getByLabel('Second saved attempt');
  await expect(first).toHaveValue('20000000-0000-4000-8000-000000000002');
  await expect(first).toBeFocused();
  await expect(second.locator('option')).toHaveText([
    'Stage 1 · Attempt 1',
    'Stage 1 · Attempt 2',
    'Stage 2 · Attempt 1'
  ]);
  await expect(history.getByRole('heading', { name: 'Stage 2 · Attempt 2' })).toBeVisible();
  await expect(history.getByRole('heading', { name: 'Stage 2 · Attempt 1' })).toBeVisible();
  await expect(history.getByText('Stage 2 latest review')).toBeVisible();
  await expect(history.getByText('Current stage 2 draft')).toHaveCount(0);
  const relationship = history.locator('.comparison-selectors .comparison-relationship');
  await expect(relationship).toBeVisible();
  const [firstBox, relationshipBox] = await Promise.all([
    first.boundingBox(),
    relationship.boundingBox()
  ]);
  expect(firstBox).not.toBeNull();
  expect(relationshipBox).not.toBeNull();
  expect(
    Math.abs(
      (firstBox?.y ?? 0) +
        (firstBox?.height ?? 0) / 2 -
        ((relationshipBox?.y ?? 0) + (relationshipBox?.height ?? 0) / 2)
    )
  ).toBeLessThan(2);

  await first.selectOption('10000000-0000-4000-8000-000000000001');
  await expect(second.locator('option')).toHaveText([
    'Stage 1 · Attempt 2',
    'Stage 2 · Attempt 1',
    'Stage 2 · Attempt 2'
  ]);
  await second.selectOption('10000000-0000-4000-8000-000000000002');
  await expect(history.getByRole('heading', { name: 'Stage 1 · Attempt 1' })).toBeVisible();
  await expect(history.getByRole('heading', { name: 'Stage 1 · Attempt 2' })).toBeVisible();
  await expect(history.getByText('Stage 1 accepted review')).toBeVisible();
  await second.selectOption('20000000-0000-4000-8000-000000000001');
  await expect(history.getByRole('heading', { name: 'Stage 1 · Attempt 1' })).toBeVisible();
  await expect(history.getByRole('heading', { name: 'Stage 2 · Attempt 1' })).toBeVisible();
  await expect(history.getByText('Stage 2 first answer', { exact: true })).toBeVisible();
  await history.getByRole('button', { name: 'Back to single attempt' }).click();
  await expect(history.getByLabel('First saved attempt')).toHaveCount(0);
  await expect(history.getByRole('heading', { name: 'Stage 1 · Attempt 1' })).toBeVisible();
  const stage1Pills = history.locator('.attempt-group').filter({ hasText: 'Stage 1' });
  await expect(stage1Pills.getByRole('button', { name: 'Attempt 1' })).toBeFocused();
  await stage1Pills.getByRole('button', { name: 'Attempt 2' }).click();
  await expect(history.getByText('Stage 1 accepted review')).toBeVisible();
  await page.keyboard.press('Escape');

  const editor = page.getByLabel('Your system design answer');
  await editor.fill('Stage 2 draft saved while navigating');
  await page.getByRole('link', { name: '01 Core design' }).click();
  await expect(page).toHaveURL(/stage=1/);
  await expect(page.getByRole('link', { name: '02 Requirement change' })).toBeVisible();
  await page.getByRole('link', { name: '02 Requirement change' }).click();
  await expect(page).toHaveURL(/stage=2/);
  await expect(editor).toHaveValue('Stage 2 draft saved while navigating');
});
test('single attempt browsing can enter and leave an unavailable comparison', async ({ page }) => {
  await page.setExtraHTTPHeaders({ 'x-test-user-id': 'single-attempt' });
  await page.goto('/app/practice/meeting-room');
  await page.getByRole('button', { name: 'Attempts 1' }).click();
  const history = page.getByRole('dialog', { name: 'Attempt history' });
  await expect(history.getByRole('button', { name: 'Attempt 1' })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  await expect(history.getByText('Only submitted answer', { exact: true })).toBeVisible();
  await expect(history.getByLabel('First saved attempt')).toHaveCount(0);
  await history.getByRole('button', { name: 'Compare attempts' }).click();
  await expect(history.getByLabel('First saved attempt')).toHaveValue(
    '40000000-0000-4000-8000-000000000001'
  );
  await expect(history.getByLabel('Second saved attempt')).toBeDisabled();
  await expect(
    history.getByText('Submit another attempt to compare two saved answers.')
  ).toBeVisible();
  await expect(history.locator('.comparison article')).toHaveCount(1);
  await expect(history.getByText(/Current stage 1 draft/i)).toHaveCount(0);
  await history.getByRole('button', { name: 'Back to single attempt' }).click();
  await expect(history.getByLabel('First saved attempt')).toHaveCount(0);
  await expect(history.getByText('Only submitted answer', { exact: true })).toBeVisible();
});
test('workspace compare action opens compare mode directly', async ({ page }) => {
  await page.setExtraHTTPHeaders({ 'x-test-user-id': 'stage-navigation' });
  await page.goto('/app/practice/meeting-room?stage=1');
  await page.getByRole('button', { name: 'Compare attempts' }).click();
  const history = page.getByRole('dialog', { name: 'Attempt history' });
  await expect(history.getByLabel('First saved attempt')).toBeVisible();
  await expect(history.getByLabel('First saved attempt')).toBeFocused();
  await expect(history.getByLabel('Second saved attempt')).toBeVisible();
  await expect(history.getByRole('button', { name: 'Back to single attempt' })).toBeVisible();
});
test('draft survives opening design, reload and an unavailable AI review', async ({ page }) => {
  await page.setExtraHTTPHeaders({ 'x-test-user-id': `test-${randomUUID()}` });
  await page.goto('/app/practice/meeting-room');
  await expect(page.getByText('02 Locked')).toBeVisible();
  await expect(page.getByRole('link', { name: /02 Locked/ })).toHaveCount(0);
  await expect(page.getByLabel('Your system design answer')).toHaveCount(0);
  await page
    .getByLabel('Your clarification question')
    .fill('Can I assume rooms have equal capacity?');
  await page.getByRole('button', { name: 'Continue to design' }).click();
  await expect(page.getByLabel('Your clarification question')).toHaveValue(
    'Can I assume rooms have equal capacity?'
  );
  await page.getByRole('button', { name: 'Ask clarification ↑' }).click();
  await expect(page.getByRole('alert')).toContainText('Live AI is not configured');
  await expect(page.getByLabel('Your clarification question')).toHaveValue(
    'Can I assume rooms have equal capacity?'
  );
  await expect(page.locator('.clarification-exchange')).toHaveCount(0);
  await expect(page.getByText('0 / 3 exchanges')).toBeVisible();
  const editor = page.getByLabel('Your system design answer');
  await editor.fill(
    'Store booking ownership and coordinate concurrent writes inside a transaction.'
  );
  await page.getByRole('button', { name: 'Close design' }).click();
  await expect(editor).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Continue to design' })).toBeFocused();
  await page.getByRole('button', { name: 'Continue to design' }).click();
  await expect(editor).toHaveValue(/Store booking ownership/);
  await expect(editor).toBeFocused();
  await expect(page.locator('.save-status')).toHaveText('Saved');
  await page.reload();
  await expect(editor).toHaveValue(/Store booking ownership/);
  await page.getByRole('button', { name: /Submit Stage 1 · Attempt 1 for review/ }).click();
  await expect(page.getByRole('alert')).toContainText('Live AI is not configured');
  await expect(editor).toHaveValue(/Store booking ownership/);
  await page.getByRole('button', { name: /Attempts/ }).click();
  await expect(page.getByRole('dialog', { name: 'Attempt history' })).toBeVisible();
  await expect(page.getByText('No submitted attempts yet.')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
test('images are resized, uploaded, inspected, and kept with a saved draft', async ({ page }) => {
  await page.setExtraHTTPHeaders({ 'x-test-user-id': `test-${randomUUID()}` });
  await page.goto('/app/practice/meeting-room');
  await page.getByRole('button', { name: 'Continue to design' }).click();
  // A valid 1x1 PNG; browser normalizes it to JPEG before server full decoding.
  const image = PNG.sync.write({ width: 4, height: 4, data: Buffer.alloc(64, 255) } as PNG);
  await page
    .locator('input[type=file]')
    .setInputFiles({ name: 'diagram.png', mimeType: 'image/png', buffer: image });
  await expect(page.locator('.attachments figure')).toHaveCount(1);
  await page.getByRole('button', { name: 'Close design' }).click();
  await expect(page.locator('.attachments figure')).toHaveCount(0);
  await page.getByRole('button', { name: 'Continue to design' }).click();
  await expect(page.locator('.attachments figure')).toHaveCount(1);
  await expect(page.locator('.save-status')).toHaveText('Saved');
  await page.getByRole('button', { name: 'Inspect image' }).click();
  await expect(page.getByRole('dialog', { name: 'Inspect attachment' })).toBeVisible();
  await page.getByRole('button', { name: 'Close image' }).click();
  await page.reload();
  await expect(page.locator('.attachments figure')).toHaveCount(1);
  await page.getByRole('button', { name: 'Remove diagram.png' }).click();
  await expect(page.locator('.attachments figure')).toHaveCount(0);
});
test('narrow screens switch views without a cramped split', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.setExtraHTTPHeaders({ 'x-test-user-id': `test-${randomUUID()}` });
  await page.goto('/app/practice/meeting-room');
  await page.getByRole('button', { name: 'Your design', exact: true }).click();
  await expect(page.getByLabel('Your system design answer')).toBeVisible();
  await expect(page.getByLabel('Problem and clarifications')).not.toBeVisible();
  await page.getByLabel('Your system design answer').fill('A mobile draft.');
  await page.getByRole('button', { name: 'Brief & questions' }).click();
  await expect(page.getByLabel('Problem and clarifications')).toBeVisible();
  await page.getByRole('button', { name: 'Your design', exact: true }).click();
  await expect(page.getByLabel('Your system design answer')).toHaveValue('A mobile draft.');
});
test('dictation assets are isolated and microphone capture requires a user action', async ({
  page
}) => {
  let microphoneRequests = 0;
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      value: () => {
        throw new Error('Microphone must not start automatically');
      }
    });
  });
  page.on('request', (request) => {
    if (request.url().includes('download.moonshine.ai')) microphoneRequests++;
  });
  await page.setExtraHTTPHeaders({ 'x-test-user-id': `test-${randomUUID()}` });
  await page.goto('/app/practice/meeting-room');
  expect(await page.evaluate(() => crossOriginIsolated)).toBe(true);
  expect(microphoneRequests).toBe(0);
  const asset = await page.request.get('/voice/moonshine/index.js');
  expect(asset.ok()).toBe(true);
  await expect(page.getByRole('button', { name: 'Dictate' })).toBeVisible();
});

test('optional real Moonshine model loading never opens the microphone', async ({ page }) => {
  test.skip(process.env.TEST_MOONSHINE !== '1', 'Opt-in network/model smoke test');
  test.setTimeout(300000);
  await page.setExtraHTTPHeaders({ 'x-test-user-id': `test-${randomUUID()}` });
  await page.goto('/app/practice/meeting-room');
  // Test identity headers must not be forwarded to the public model CDN.
  await page.setExtraHTTPHeaders({});
  const result = await page.evaluate(async () => {
    let microphoneCalls = 0;
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      value: () => {
        microphoneCalls++;
        throw new Error('Microphone not permitted in this test');
      }
    });
    const moduleUrl = '/voice/moonshine/index.js';
    const voice = await import(moduleUrl);
    let progress = 0;
    const mic = new voice.MicTranscriber()
      .language('en')
      .modelArch(voice.ModelArch.MediumStreaming)
      .onProgress((fraction: number) => {
        progress = fraction;
      });
    try {
      await mic.load();
      return { progress, microphoneCalls };
    } finally {
      mic.close();
    }
  });
  expect(result.microphoneCalls).toBe(0);
  expect(result.progress).toBeGreaterThan(0);
});
