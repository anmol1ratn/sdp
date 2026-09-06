import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      $lib: fileURLToPath(new URL('./src/lib', import.meta.url)),
      '$env/dynamic/private': fileURLToPath(
        new URL('./tests/support/environment.ts', import.meta.url)
      ),
      '$app/environment': fileURLToPath(new URL('./tests/support/environment.ts', import.meta.url))
    }
  },
  test: {
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html']
    }
  }
});
