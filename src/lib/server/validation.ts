import { z } from 'zod';

export const noteInputSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, 'Write something first.')
    .max(5_000, 'Keep notes under 5,000 characters.')
});

export const noteIdSchema = z.string().uuid();

export function safeInternalPath(value: string | null, fallback = '/app') {
  if (!value?.startsWith('/')) return fallback;

  const base = new URL('https://internal.invalid');
  const parsed = new URL(value, base);
  if (parsed.origin !== base.origin) return fallback;

  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}
