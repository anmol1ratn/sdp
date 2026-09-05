import type {
  D1Database,
  ExecutionContext,
  IncomingRequestCfProperties
} from '@cloudflare/workers-types';
import type { createAuth } from '$lib/server/auth';

type Auth = ReturnType<typeof createAuth>;
type AuthSession = Auth['$Infer']['Session'];

declare global {
  namespace App {
    interface Error {
      message: string;
    }

    interface Locals {
      auth: Auth | null;
      session: AuthSession['session'] | null;
      user: AuthSession['user'] | null;
    }

    interface Platform {
      env: {
        DB: D1Database;
        BETTER_AUTH_SECRET?: string;
        BETTER_AUTH_URL?: string;
        GOOGLE_CLIENT_ID?: string;
        GOOGLE_CLIENT_SECRET?: string;
      };
      context: ExecutionContext;
      caches: CacheStorage;
      cf?: IncomingRequestCfProperties;
    }
  }
}
