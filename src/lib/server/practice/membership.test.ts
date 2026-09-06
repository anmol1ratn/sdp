import type { RequestEvent } from '@sveltejs/kit';
import { describe, expect, it, vi } from 'vitest';

vi.mock('$app/environment', () => ({ dev: false, building: false, env: {} }));

import { context } from './store';

function event(mode: string, allowed?: string, signedIn = true) {
  return {
    locals: { user: signedIn ? { id: 'verified-user', email: 'member@example.com' } : null },
    platform: { env: { DB: {}, AUTH_MODE: mode, PRACTICE_ALLOWED_EMAILS: allowed } }
  } as unknown as RequestEvent;
}

describe('production practice membership', () => {
  it('accepts an Access-authenticated member without a second allowlist', () => {
    expect(context(event('cloudflare-access')).owner).toBe('verified-user');
    expect(context(event('cloudflare-access', 'previous-member@example.com')).owner).toBe(
      'verified-user'
    );
  });
  it('still rejects unauthenticated requests in Access mode', () => {
    expect(() => context(event('cloudflare-access', undefined, false))).toThrow();
  });
  it('retains the allowlist for legacy authentication', () => {
    expect(() => context(event(''))).toThrow();
    expect(() => context(event('', 'other@example.com'))).toThrow();
    expect(context(event('', 'member@example.com')).owner).toBe('verified-user');
  });
});
