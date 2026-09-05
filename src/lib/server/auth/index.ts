import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { betterAuth } from 'better-auth/minimal';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { getRequestEvent } from '$app/server';
import { createDb } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';
import type { RuntimeEnv } from '$lib/server/env';

export function createAuth(env: RuntimeEnv) {
  const baseUrl = new URL(env.BETTER_AUTH_URL);

  return betterAuth({
    appName: 'Cloudflare SvelteKit Starter',
    baseURL: baseUrl.origin,
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(createDb(env.DB), {
      provider: 'sqlite',
      schema
    }),
    emailAndPassword: {
      enabled: false
    },
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET
      }
    },
    trustedOrigins: [baseUrl.origin],
    advanced: {
      database: {
        generateId: 'uuid'
      },
      useSecureCookies: baseUrl.protocol === 'https:'
    },
    plugins: [sveltekitCookies(getRequestEvent)]
  });
}
