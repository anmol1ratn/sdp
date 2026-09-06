import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import type { D1Database } from '@cloudflare/workers-types';
export function database() {
  const sqlite = new DatabaseSync(':memory:');
  for (const file of readdirSync('migrations')
    .filter((f) => f.endsWith('.sql'))
    .sort())
    sqlite.exec(readFileSync(`migrations/${file}`, 'utf8'));
  class Statement {
    args: unknown[] = [];
    constructor(readonly query: string) {}
    bind(...values: unknown[]) {
      this.args = values;
      return this;
    }
    execute() {
      const result = sqlite.prepare(this.query).run(...(this.args as never[]));
      return { success: true, meta: { changes: Number(result.changes) } };
    }
    async run() {
      return this.execute();
    }
    async first() {
      return sqlite.prepare(this.query).get(...(this.args as never[])) ?? null;
    }
    async all() {
      return { results: sqlite.prepare(this.query).all(...(this.args as never[])), success: true };
    }
  }
  const db = {
    prepare: (query: string) => new Statement(query),
    batch: async (statements: Statement[]) => {
      sqlite.exec('BEGIN');
      try {
        const results = statements.map((s) => s.execute());
        sqlite.exec('COMMIT');
        return results;
      } catch (e) {
        sqlite.exec('ROLLBACK');
        throw e;
      }
    }
  } as unknown as D1Database;
  return { db, sqlite };
}
