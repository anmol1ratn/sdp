import { context, workspace } from '$lib/server/practice/store';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
  const requested = Number(event.url.searchParams.get('stage') ?? 1);
  const stage = Number.isInteger(requested) && requested > 0 ? requested : 1;
  return { workspace: await workspace(context(event), event.params.problem, stage) };
};
