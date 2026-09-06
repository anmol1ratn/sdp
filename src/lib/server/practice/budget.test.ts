import { describe, expect, it } from 'vitest';
import { database } from '../../../../tests/support/d1';
import { configFrom, cost, RESERVED_INPUT, RESERVED_OUTPUT, reserve, settle } from './budget';

describe('atomic AI accounting', () => {
  it('allows only one of two concurrent reservations against a shared remaining cap', async () => {
    const { db, sqlite } = database();
    const config = configFrom({});
    const maximum = cost(RESERVED_INPUT, RESERVED_OUTPUT, config);
    config.userCap = maximum;
    config.globalCap = maximum * 2;
    const results = await Promise.allSettled([
      reserve(db, 'a', 'reader', 'a', config),
      reserve(db, 'b', 'reader', 'b', config)
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(sqlite.prepare('SELECT COUNT(*) n FROM ai_calls').get()?.n).toBe(1);
    expect(sqlite.prepare('SELECT SUM(spent) n FROM ai_budget').get()?.n).toBe(maximum * 2);
  });
  it('enforces the global cap across distinct authenticated users', async () => {
    const { db } = database();
    const config = configFrom({});
    config.globalCap = cost(RESERVED_INPUT, RESERVED_OUTPUT, config);
    await reserve(db, 'a', 'alice', 'a', config);
    await expect(reserve(db, 'b', 'bob', 'b', config)).rejects.toMatchObject({ status: 429 });
  });
  it('reconciles thinking and output once, preserving charges for lost responses', async () => {
    const { db, sqlite } = database();
    const config = configFrom({});
    const maximum = await reserve(db, 'a', 'reader', 'a', config);
    expect(sqlite.prepare('SELECT charged FROM ai_calls').get()?.charged).toBe(maximum);
    await settle(db, 'a', 12000, { ok: true });
    await settle(db, 'a', 0, { ok: true });
    expect(sqlite.prepare('SELECT SUM(spent) n FROM ai_budget').get()?.n).toBe(24000);
    await expect(reserve(db, 'a', 'reader', 'different', config)).rejects.toThrow();
    expect(sqlite.prepare('SELECT SUM(spent) n FROM ai_budget').get()?.n).toBe(24000);
  });
  it('rolls prices forward in January and refuses unpriced replacement models', () => {
    expect(configFrom({}, new Date('2026-12-31T23:59:59Z')).outputRate).toBe(3.75);
    expect(configFrom({}, new Date('2027-01-01T00:00:00Z')).outputRate).toBe(7.5);
    expect(() => configFrom({ GEMINI_MODEL: 'different' })).toThrow();
  });
});
