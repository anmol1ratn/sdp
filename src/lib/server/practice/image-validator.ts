import { DurableObject } from 'cloudflare:workers';
import { imageBody } from './image-body';
import { decodeImage } from './images';
// SQLite-backed Durable Objects are available on Workers Free. Their 30-second
// CPU allowance keeps full decoding away from the HTTP Worker's 10-ms limit.
// No object storage, timers, or background processes are used by this class.
export class ImageValidator extends DurableObject {
  async fetch(request: Request): Promise<Response> {
    try {
      const bytes = await imageBody(request);
      return Response.json(decodeImage(bytes, request.headers.get('content-type') ?? ''));
    } catch (e) {
      return Response.json(
        { message: e instanceof Error ? e.message : 'Invalid image.' },
        { status: 400 }
      );
    }
  }
}
