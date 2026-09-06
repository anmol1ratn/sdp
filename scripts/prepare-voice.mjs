import { cp, mkdir } from 'node:fs/promises';

await mkdir('static/voice/moonshine', { recursive: true });
await cp('node_modules/@moonshine-ai/moonshine-wasm/dist', 'static/voice/moonshine', {
  recursive: true,
  filter: (source) => !source.endsWith('.map') && !source.endsWith('.ts')
});
