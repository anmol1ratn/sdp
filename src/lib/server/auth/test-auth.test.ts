import { describe, expect, it } from 'vitest';
import { getTestSession } from './test-auth';

describe('getTestSession', () => {
  it('creates a deterministic session only when explicitly enabled in development', () => {
    const headers = new Headers({ 'x-test-user-id': 'user-123' });

    expect(getTestSession({ enabled: true, development: true, headers })?.user).toMatchObject({
      id: 'user-123',
      email: 'test@example.com'
    });
    expect(getTestSession({ enabled: false, development: true, headers })).toBeNull();
    expect(getTestSession({ enabled: true, development: false, headers })).toBeNull();
  });

  it('does not authenticate a request without the test header', () => {
    expect(getTestSession({ enabled: true, development: true, headers: new Headers() })).toBeNull();
  });
});
