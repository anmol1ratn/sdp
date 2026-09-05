import type { D1Database } from '@cloudflare/workers-types';
import { error } from '@sveltejs/kit';
import { z } from 'zod';
import { env as privateEnv } from '$env/dynamic/private';

const d1BindingSchema = z.custom<D1Database>(
  (value) =>
    typeof value === 'object' &&
    value !== null &&
    'prepare' in value &&
    typeof value.prepare === 'function',
  'The DB D1 binding is unavailable'
);

const runtimeEnvSchema = z.object({
  DB: d1BindingSchema,
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url(),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1)
});

export type RuntimeEnv = z.infer<typeof runtimeEnvSchema>;

export function getRuntimeEnv(platform: App.Platform | undefined): RuntimeEnv {
  const result = runtimeEnvSchema.safeParse({
    ...privateEnv,
    ...platform?.env
  });

  if (!result.success) {
    const missing = result.error.issues.map((issue) => issue.path.join('.')).join(', ');
    console.error(`Invalid server environment configuration: ${missing}`);
    error(500, 'Server configuration is incomplete. Check the deployment environment.');
  }

  return result.data;
}
