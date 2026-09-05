import { expect, test } from '@playwright/test';

const testUserId = '00000000-0000-4000-8000-000000000001';

test('serves the prerenderable public landing page', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /ship the useful thing/i })).toBeVisible();
});

test('redirects a guest away from the protected app', async ({ page }) => {
  await page.goto('/app');
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fapp$/);
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
});

test('mounts Better Auth and starts Google OAuth without live credentials', async ({ request }) => {
  const session = await request.get('/api/auth/get-session');
  expect(session.status()).toBe(200);
  expect(await session.json()).toBeNull();

  const signIn = await request.post('/api/auth/sign-in/social', {
    data: {
      provider: 'google',
      callbackURL: 'http://127.0.0.1:4173/app'
    }
  });
  expect(signIn.status()).toBe(200);
  expect((await signIn.json()).url).toMatch(/^https:\/\/accounts\.google\.com\//);
  expect(signIn.headers()['set-cookie']).toContain('HttpOnly');
});

test('allows a deterministic development-only session into protected routes', async ({
  browser
}) => {
  const context = await browser.newContext({
    extraHTTPHeaders: { 'x-test-user-id': testUserId }
  });
  const page = await context.newPage();

  await page.goto('/app');
  await expect(page.getByRole('heading', { name: 'Your notes' })).toBeVisible();
  await expect(page.getByText('Signed in as test@example.com')).toBeVisible();

  const noteBody = `Playwright note ${crypto.randomUUID()}`;
  await page.getByLabel('New note').fill(noteBody);
  await page.getByRole('button', { name: 'Save note' }).click();
  const note = page.getByRole('listitem').filter({ hasText: noteBody });
  await expect(note).toBeVisible();

  const response = await context.request.get('/api/me');
  expect(response.status()).toBe(200);
  await expect(response.json()).resolves.toMatchObject({
    id: testUserId,
    email: 'test@example.com'
  });

  await note.getByRole('button', { name: 'Delete' }).click();
  await expect(note).toBeHidden();

  await context.close();
});
