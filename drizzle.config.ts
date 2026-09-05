import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/lib/server/db/schema.ts',
  out: './migrations',
  migrations: {
    prefix: 'timestamp'
  },
  strict: true,
  verbose: true
});
