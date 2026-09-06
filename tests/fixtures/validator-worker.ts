import type { DurableObjectNamespace } from '@cloudflare/workers-types';

export { ImageValidator } from '../../src/lib/server/practice/image-validator';
// Local smoke-test entry only. The production entrypoint never exposes this route.
export default {
  async fetch(request: Request, env: { IMAGE_VALIDATOR: DurableObjectNamespace }) {
    return env.IMAGE_VALIDATOR.get(env.IMAGE_VALIDATOR.idFromName('smoke')).fetch(request.url, {
      method: request.method,
      headers: Array.from(request.headers.entries()),
      body: request.body ? await request.arrayBuffer() : undefined
    });
  }
};
