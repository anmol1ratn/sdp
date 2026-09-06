import type { Handle } from '@sveltejs/kit';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { building, dev } from '$app/environment';
import { env as privateEnv } from '$env/dynamic/private';
import { createAuth } from '$lib/server/auth';
import { accessUser } from '$lib/server/auth/access';
import { getTestSession } from '$lib/server/auth/test-auth';
import { getRuntimeEnv } from '$lib/server/env';

const authenticatedPaths = [
  '/app',
  '/api/auth',
  '/api/me',
  '/api/practice',
  '/api/attachments',
  '/sign-in'
];

function needsAuthentication(pathname: string) {
  return authenticatedPaths.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

function addSecurityHeaders(response: Response) {
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(self), geolocation=()');
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  response.headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
  if (!response.headers.has('Cache-Control'))
    response.headers.set('Cache-Control', 'private, no-store');
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

  const settings = { ...privateEnv, ...event.platform?.env };
  if (
    dev &&
    settings.LOCAL_PRACTICE_MODE === 'true' &&
    ['localhost', '127.0.0.1', '[::1]'].includes(event.url.hostname)
  ) {
    const local = getTestSession({
      enabled: true,
      development: true,
      headers: new Headers({ 'x-test-user-id': 'local-practice' })
    });
    event.locals.user = local?.user ?? null;
    event.locals.session = local?.session ?? null;
    return addSecurityHeaders(await resolve(event));
  }
  if (settings.AUTH_MODE === 'cloudflare-access') {
    event.locals.user = await accessUser(event.request.headers, settings);
    if (!event.locals.user) {
      return addSecurityHeaders(
        new Response('Cloudflare Access sign-in is required.', { status: 401 })
      );
    }
    return addSecurityHeaders(await resolve(event));
  }
  if (
    !settings.BETTER_AUTH_SECRET ||
    !settings.GOOGLE_CLIENT_ID ||
    !settings.GOOGLE_CLIENT_SECRET ||
    !settings.BETTER_AUTH_URL
  ) {
    return addSecurityHeaders(await resolve(event));
  }
  const auth = createAuth(getRuntimeEnv(event.platform));
  event.locals.auth = auth;

  const authSession = await auth.api.getSession({ headers: event.request.headers });
  event.locals.session = authSession?.session ?? null;
  event.locals.user = authSession?.user ?? null;

  return addSecurityHeaders(await svelteKitHandler({ event, resolve, auth, building }));
};
