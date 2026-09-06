import { error } from '@sveltejs/kit';
import { context } from '$lib/server/practice/store';
import type { RequestHandler } from './$types';
export const GET: RequestHandler = async (event) => {
  const ctx = context(event);
  const row = await ctx.db
    .prepare('SELECT mime,problem FROM practice_attachments WHERE id=? AND owner=?')
    .bind(event.params.id, ctx.owner)
    .first<{ mime: string; problem: string }>();
  if (!row) error(404, 'Image not found.');
  const object =
    (await ctx.env.ATTACHMENTS?.get(`${ctx.owner}/${row.problem}/${event.params.id}`)) ??
    (await ctx.env.ATTACHMENTS?.get(`${ctx.owner}/${event.params.id}`));
  if (!object) error(404, 'Image not found.');
  return new Response(object.body as unknown as ReadableStream, {
    headers: {
      'Content-Type': row.mime,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff'
    }
  });
};
