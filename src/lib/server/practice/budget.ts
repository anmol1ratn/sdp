import type { D1Database } from '@cloudflare/workers-types';
import { error } from '@sveltejs/kit';
export type AIConfig = {
  key: string;
  model: string;
  inputRate: number;
  outputRate: number;
  userCap: number;
  globalCap: number;
};
export const MAX_INPUT_BYTES = 80000;
export const MAX_OUTPUT = 8192;
// Conservative ceiling: byte-level text bound plus 16k tokens/image; also reserve the
// model's full 65,536-token thinking ceiling in addition to our output cap.
export const RESERVED_INPUT = MAX_INPUT_BYTES + 32768;
export const RESERVED_OUTPUT = MAX_OUTPUT + 65536;
export function cost(
  input: number,
  output: number,
  config: Pick<AIConfig, 'inputRate' | 'outputRate'>
) {
  return Math.ceil(input * config.inputRate + output * config.outputRate); // integer micro-USD
}
export function configFrom(env: Record<string, unknown>, now = new Date()): AIConfig {
  const model = String(env.GEMINI_MODEL || 'gemini-3.8-flash');
  const later = now >= new Date('2027-01-01T00:00:00Z');
  const rate = (name: string, fallback: number) => {
    const value = Number(env[name] ?? fallback);
    if (!Number.isFinite(value) || value <= 0)
      error(503, 'AI pricing or budget configuration is invalid.');
    return value;
  };
  if (
    model !== 'gemini-3.8-flash' &&
    (!env.AI_INPUT_USD_PER_MILLION || !env.AI_OUTPUT_USD_PER_MILLION)
  )
    error(503, 'Set explicit server-side prices before selecting a different model.');
  return {
    key: String(env.GEMINI_API_KEY || ''),
    model,
    inputRate: rate('AI_INPUT_USD_PER_MILLION', later ? 1.5 : 0.75),
    outputRate: rate('AI_OUTPUT_USD_PER_MILLION', later ? 7.5 : 3.75),
    userCap: Math.round(rate('AI_USER_MONTHLY_USD', 5) * 1e6),
    globalCap: Math.round(rate('AI_GLOBAL_MONTHLY_USD', 25) * 1e6)
  };
}
export async function reserve(
  db: D1Database,
  id: string,
  owner: string,
  fingerprint: string,
  config: AIConfig,
  problem = 'meeting-room'
) {
  const month = new Date().toISOString().slice(0, 7);
  const reserved = cost(RESERVED_INPUT, RESERVED_OUTPUT, config);
  try {
    await db.batch([
      db
        .prepare(
          'INSERT INTO ai_budget(id,cap) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET cap=excluded.cap'
        )
        .bind(`${owner}:${month}`, config.userCap),
      db
        .prepare(
          'INSERT INTO ai_budget(id,cap) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET cap=excluded.cap'
        )
        .bind(`global:${month}`, config.globalCap),
      db
        .prepare(
          'INSERT INTO ai_calls(id,owner,problem,month,fingerprint,reserved,charged,created_at) VALUES (?,?,?,?,?,?,?,?)'
        )
        .bind(id, owner, problem, month, fingerprint, reserved, reserved, Date.now())
    ]);
  } catch (e) {
    if (String(e).includes('budget_exceeded'))
      error(
        429,
        'The monthly AI budget has insufficient room for another request. Drafts are still available.'
      );
    throw e;
  }
  return reserved;
}
export async function settle(db: D1Database, id: string, charged: number, result: unknown) {
  await db
    .prepare('UPDATE ai_calls SET charged=?, settled=1, result=? WHERE id=? AND settled=0')
    .bind(charged, JSON.stringify(result), id)
    .run();
}
