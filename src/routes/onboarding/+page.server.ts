import type { PageServerLoad } from './$types';
import { buildOnboardingSeo } from '$lib/seo';

export const load: PageServerLoad = ({ url }) => {
  return {
    seo: buildOnboardingSeo(url)
  };
};
