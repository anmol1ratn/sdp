import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { beforeAll, describe, expect, it } from 'vitest';
import { accessUser } from './access';

const settings = {
  ACCESS_TEAM_DOMAIN: 'https://test-team.cloudflareaccess.com',
  ACCESS_AUD: 'practice-audience'
};
let pair: Awaited<ReturnType<typeof generateKeyPair>>;
let keys: ReturnType<typeof createLocalJWKSet>;
beforeAll(async () => {
  pair = await generateKeyPair('RS256');
  keys = createLocalJWKSet({ keys: [{ ...(await exportJWK(pair.publicKey)), kid: 'test-key' }] });
});
async function token(overrides: Record<string, unknown> = {}) {
  return new SignJWT({
    iss: settings.ACCESS_TEAM_DOMAIN,
    aud: settings.ACCESS_AUD,
    sub: 'user-one',
    email: 'Member@example.com',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...overrides
  })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
    .sign(pair.privateKey);
}
async function user(overrides: Record<string, unknown> = {}) {
  return accessUser(
    new Headers({ 'cf-access-jwt-assertion': await token(overrides) }),
    settings,
    keys
  );
}
describe('Cloudflare Access identity', () => {
  it('keeps a stable user ID across sessions and separates different members', async () => {
    const first = await user();
    const renewed = await user({ iat: Math.floor(Date.now() / 1000) - 10 });
    const other = await user({ sub: 'user-two', email: 'other@example.com' });
    expect(first?.email).toBe('member@example.com');
    expect(first?.id).toBe('access:test-team.cloudflareaccess.com:user-one');
    expect(renewed?.id).toBe(first?.id);
    expect(other?.id).not.toBe(first?.id);
  });
  it.each([
    { iss: 'https://another-team.cloudflareaccess.com' },
    { aud: 'another-application' },
    { exp: 1 },
    { nbf: Math.floor(Date.now() / 1000) + 3600 },
    { sub: '' },
    { email: null },
    { exp: undefined }
  ])('rejects invalid claims %j', async (claims) => {
    expect(await user(claims)).toBeNull();
  });
  it('rejects a forged signature', async () => {
    const forgedPair = await generateKeyPair('RS256');
    const forged = await new SignJWT({ email: 'member@example.com' })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
      .setIssuer(settings.ACCESS_TEAM_DOMAIN)
      .setAudience(settings.ACCESS_AUD)
      .setSubject('user-one')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(forgedPair.privateKey);
    expect(
      await accessUser(new Headers({ 'cf-access-jwt-assertion': forged }), settings, keys)
    ).toBeNull();
  });
  it('does not trust email, test identity, or cookie headers without an assertion', async () => {
    const headers = new Headers({
      'cf-access-authenticated-user-email': 'member@example.com',
      'x-test-user-id': 'user-one',
      cookie: `CF_Authorization=${await token()}`
    });
    expect(await accessUser(headers, settings, keys)).toBeNull();
  });
  it('fails closed for missing or unsafe deployment configuration', async () => {
    const headers = new Headers({ 'cf-access-jwt-assertion': await token() });
    expect(await accessUser(headers, {}, keys)).toBeNull();
    expect(
      await accessUser(
        headers,
        { ...settings, ACCESS_TEAM_DOMAIN: 'http://test-team.cloudflareaccess.com' },
        keys
      )
    ).toBeNull();
  });
});
