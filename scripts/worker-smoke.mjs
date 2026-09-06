import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import jpeg from 'jpeg-js';

const port = 4176;
const runtime = spawn(
  'pnpm',
  [
    'exec',
    'wrangler',
    'dev',
    '--local',
    '--config',
    'tests/fixtures/wrangler.validator.jsonc',
    '--port',
    String(port)
  ],
  { stdio: ['ignore', 'pipe', 'pipe'] }
);
let logs = '';
runtime.stdout.on('data', (chunk) => (logs += chunk));
runtime.stderr.on('data', (chunk) => (logs += chunk));
const url = `http://127.0.0.1:${port}/validate`;
try {
  let ready = false;
  for (let i = 0; i < 60; i++) {
    try {
      await fetch(url);
      ready = true;
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  if (!ready) throw new Error(`Local validator failed to start: ${logs}`);
  const bytes = jpeg.encode({ width: 2, height: 2, data: Buffer.alloc(16, 255) }, 80).data;
  const valid = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'image/jpeg' },
    body: bytes
  });
  assert.equal(valid.status, 200);
  assert.deepEqual(await valid.json(), { width: 2, height: 2, mime: 'image/jpeg' });
  const invalid = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'image/jpeg' },
    body: new Uint8Array(32)
  });
  assert.equal(invalid.status, 400);
  console.log(
    'Real workerd Durable Object smoke passed: valid full decoding and corrupt-image rejection.'
  );
} finally {
  runtime.kill('SIGTERM');
}
