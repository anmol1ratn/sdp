import { json } from '@sveltejs/kit';
import { requireUser } from '$lib/server/auth/guard';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ locals }) => {
  const user = requireUser(locals);
  return json({ id: user.id, name: user.name, email: user.email });
};
