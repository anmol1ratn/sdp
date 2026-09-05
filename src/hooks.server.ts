import type { Handle } from '@sveltejs/kit';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { building, dev } from '$app/environment';
import { env as privateEnv } from '$env/dynamic/private';
import { createAuth } from '$lib/server/auth';
import { getTestSession } from '$lib/server/auth/test-auth';
import { getRuntimeEnv } from '$lib/server/env';

const authenticatedPaths = ['/app', '/api/auth', '/api/me', '/sign-in'];

function needsAuthentication(pathname: string) {
  return authenticatedPaths.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

function addSecurityHeaders(response: Response) {
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  return response;
}

export const handle: Handle = async ({ event, resolve }) => {
  event.locals.auth = null;
  event.locals.session = null;
  event.locals.user = null;

  if (building || !needsAuthentication(event.url.pathname)) {
    return addSecurityHeaders(await resolve(event));
  }

  if (dev && privateEnv.AUTH_TEST_MODE === 'true' && !event.url.pathname.startsWith('/api/auth')) {
    const testSession = getTestSession({
      enabled: true,
      development: true,
      headers: event.request.headers
    });
    event.locals.session = testSession?.session ?? null;
    event.locals.user = testSession?.user ?? null;
    return addSecurityHeaders(await resolve(event));
  }

  const auth = createAuth(getRuntimeEnv(event.platform));
  event.locals.auth = auth;

  const authSession = await auth.api.getSession({ headers: event.request.headers });
  event.locals.session = authSession?.session ?? null;
  event.locals.user = authSession?.user ?? null;

  return addSecurityHeaders(await svelteKitHandler({ event, resolve, auth, building }));
};
