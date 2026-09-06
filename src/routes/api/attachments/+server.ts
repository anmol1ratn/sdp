import { error, isHttpError, json } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { imageBody } from '$lib/server/practice/image-body';
import { getProblem } from '$lib/server/practice/problem';
import { context } from '$lib/server/practice/store';
import type { RequestHandler } from './$types';
export const POST: RequestHandler = async (event) => {
  if (event.request.headers.get('origin') !== event.url.origin)
    error(403, 'Same-origin requests only.');
  const ctx = context(event),
    bucket = ctx.env.ATTACHMENTS;
  const problem = getProblem(event.request.headers.get('x-problem-id') ?? 'meeting-room');
  if (!bucket)
    error(
      503,
      'Image storage is not configured yet. Keep writing; attachments can be added when R2 is configured.'
    );
  let bytes: Uint8Array, decoded: { width: number; height: number; mime: string };
  try {
    bytes = await imageBody(event.request);
    const mime = event.request.headers.get('content-type') ?? '';
    if (dev) {
      const { decodeImage } = await import('$lib/server/practice/images');
      decoded = decodeImage(bytes, mime);
    } else {
      const validator = ctx.env.IMAGE_VALIDATOR;
      if (!validator)
        error(503, 'Image validation is not configured yet. Your text draft is safe.');
      const response = await validator
        .get(validator.idFromName(ctx.owner))
        .fetch('https://image-validator/validate', {
          method: 'POST',
          headers: { 'Content-Type': mime },
          body: bytes
        });
      if (!response.ok) throw new Error(((await response.json()) as { message: string }).message);
      decoded = (await response.json()) as typeof decoded;
    }
  } catch (e) {
    if (isHttpError(e)) throw e;
    error(400, e instanceof Error ? e.message : 'Invalid image.');
  }
  const id = crypto.randomUUID();
  let name = 'Diagram';
  try {
    name = decodeURIComponent(event.request.headers.get('x-file-name') ?? 'Diagram').slice(0, 100);
  } catch {}
  const key = `${ctx.owner}/${problem.id}/${id}`;
  await bucket.put(key, bytes, { httpMetadata: { contentType: decoded.mime } });
  try {
    await ctx.db
      .prepare(
        'INSERT INTO practice_attachments(id,owner,problem,name,mime,width,height,bytes,created_at) VALUES (?,?,?,?,?,?,?,?,?)'
      )
      .bind(
        id,
        ctx.owner,
        problem.id,
        name,
        decoded.mime,
        decoded.width,
        decoded.height,
        bytes.length,
        Date.now()
      )
      .run();
  } catch (e) {
    await bucket.delete(key);
    if (String(e).includes('storage_limit'))
      error(
        429,
        'Your image storage allowance is full. Contact the space owner to archive old attachments.'
      );
    throw e;
  }
  return json({ id, name, ...decoded });
};
