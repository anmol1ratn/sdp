import { fail, redirect } from '@sveltejs/kit';
import { and, desc, eq } from 'drizzle-orm';
import { requireAuth, requireUser } from '$lib/server/auth/guard';
import { createDb } from '$lib/server/db';
import { notes } from '$lib/server/db/schema';
import { noteIdSchema, noteInputSchema } from '$lib/server/validation';
import type { Actions, PageServerLoad } from './$types';

function database(platform: App.Platform | undefined) {
  if (!platform?.env.DB) throw new Error('The DB binding is unavailable.');
  return createDb(platform.env.DB);
}

export const load: PageServerLoad = async ({ locals, platform }) => {
  const user = requireUser(locals);
  const userNotes = await database(platform)
    .select()
    .from(notes)
    .where(eq(notes.ownerId, user.id))
    .orderBy(desc(notes.updatedAt))
    .limit(50);

  return { notes: userNotes };
};

export const actions = {
  create: async ({ locals, platform, request }) => {
    const user = requireUser(locals);
    const form = await request.formData();
    const body = form.get('body');
    const parsed = noteInputSchema.safeParse({ body });

    if (!parsed.success) {
      return fail(400, {
        action: 'create',
        body: typeof body === 'string' ? body.slice(0, 5_000) : '',
        message: parsed.error.issues[0]?.message ?? 'Invalid note.'
      });
    }

    const now = new Date();
    await database(platform).insert(notes).values({
      id: crypto.randomUUID(),
      ownerId: user.id,
      body: parsed.data.body,
      createdAt: now,
      updatedAt: now
    });

    return { action: 'create', success: true };
  },
  delete: async ({ locals, platform, request }) => {
    const user = requireUser(locals);
    const form = await request.formData();
    const parsed = noteIdSchema.safeParse(form.get('id'));

    if (!parsed.success)
      return fail(400, { action: 'delete', message: 'Invalid note identifier.' });

    await database(platform)
      .delete(notes)
      .where(and(eq(notes.id, parsed.data), eq(notes.ownerId, user.id)));

    return { action: 'delete', success: true };
  },
  signout: async ({ locals, request }) => {
    await requireAuth(locals).api.signOut({ headers: request.headers });
    redirect(303, '/');
  }
} satisfies Actions;
