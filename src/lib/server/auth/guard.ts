import { error } from '@sveltejs/kit';

export function requireUser(locals: App.Locals) {
  if (!locals.user) {
    error(401, 'Authentication required');
  }

  return locals.user;
}

export function requireAuth(locals: App.Locals) {
  if (!locals.auth) {
    error(500, 'Authentication service is unavailable');
  }

  return locals.auth;
}
