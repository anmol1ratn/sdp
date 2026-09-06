import { createRemoteJWKSet, type JWTVerifyGetKey, jwtVerify } from 'jose';

const keySets = new Map<string, JWTVerifyGetKey>();

export interface AccessSettings {
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
}

// The issuer and keys come only from deployment configuration, never from a token.
export async function accessUser(
  headers: Headers,
  settings: AccessSettings,
  verificationKey?: JWTVerifyGetKey
): Promise<App.Locals['user']> {
  const token = headers.get('cf-access-jwt-assertion');
  if (!token || !settings.ACCESS_TEAM_DOMAIN || !settings.ACCESS_AUD) return null;
  try {
    const issuer = new URL(settings.ACCESS_TEAM_DOMAIN);
    if (
      issuer.protocol !== 'https:' ||
      !issuer.hostname.endsWith('.cloudflareaccess.com') ||
      issuer.username ||
      issuer.password ||
      issuer.port ||
      issuer.pathname !== '/' ||
      issuer.search ||
      issuer.hash
    )
      return null;

    let keys = verificationKey ?? keySets.get(issuer.origin);
    if (!keys) {
      keys = createRemoteJWKSet(new URL('/cdn-cgi/access/certs', issuer));
      keySets.set(issuer.origin, keys);
    }
    const { payload } = await jwtVerify(token, keys, {
      issuer: issuer.origin,
      audience: settings.ACCESS_AUD,
      algorithms: ['RS256'],
      requiredClaims: ['sub', 'email', 'exp', 'iat']
    });
    if (
      typeof payload.sub !== 'string' ||
      !payload.sub.trim() ||
      typeof payload.email !== 'string' ||
      !payload.email.includes('@')
    )
      return null;

    // Namespacing by issuer keeps identities separate if a deployment changes teams.
    const id = `access:${issuer.hostname}:${payload.sub}`;
    const email = payload.email.trim().toLowerCase();
    return {
      id,
      email,
      name: typeof payload.name === 'string' ? payload.name : email,
      emailVerified: true,
      createdAt: new Date(0),
      updatedAt: new Date(0)
    };
  } catch {
    // Never fall back to unverified headers or expose tokens in errors/logs.
    return null;
  }
}
