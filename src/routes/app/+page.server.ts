import { context, dashboard } from '$lib/server/practice/store';
import type { PageServerLoad } from './$types';
export const load: PageServerLoad = async (event) => ({
  problems: await dashboard(context(event))
});
