import { fail, redirect } from '@sveltejs/kit';
import { requireAuth } from '$lib/server/auth/guard';
import { safeInternalPath } from '$lib/server/validation';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, url }) => {
  const next = safeInternalPath(url.searchParams.get('next'));
  if (locals.user) redirect(303, next);
  return { next, configured: !!locals.auth };
};

export const actions = {
  default: async ({ locals, request, url }) => {
    const form = await request.formData();
    const nextValue = form.get('next');
    const next = safeInternalPath(typeof nextValue === 'string' ? nextValue : null);
    const callbackURL = new URL(next, url.origin).toString();

    const result = await requireAuth(locals).api.signInSocial({
      body: {
        provider: 'google',
        callbackURL
      },
      headers: request.headers
    });

    if (!result.url)
      return fail(502, { message: 'Google sign-in could not be started. Please try again.' });
    redirect(303, result.url);
  }
} satisfies Actions;
