import type {
  D1Database,
  DurableObjectNamespace,
  ExecutionContext,
  IncomingRequestCfProperties,
  R2Bucket
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
        AUTH_MODE?: string;
        ACCESS_TEAM_DOMAIN?: string;
        ACCESS_AUD?: string;
        DB: D1Database;
        ATTACHMENTS?: R2Bucket;
        IMAGE_VALIDATOR?: DurableObjectNamespace;
        GEMINI_API_KEY?: string;
        GEMINI_MODEL?: string;
        AI_USER_MONTHLY_USD?: string;
        AI_GLOBAL_MONTHLY_USD?: string;
        AI_INPUT_USD_PER_MILLION?: string;
        AI_OUTPUT_USD_PER_MILLION?: string;
        PRACTICE_ALLOWED_EMAILS?: string;
        LOCAL_PRACTICE_MODE?: string;
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
