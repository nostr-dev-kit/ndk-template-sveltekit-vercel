import type { PageServerLoad } from './$types';
import { buildRelaysSeo } from '$lib/seo';

export const load: PageServerLoad = ({ setHeaders, url }) => {
  setHeaders({
    'cache-control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=3600'
  });

  return {
    seo: buildRelaysSeo(url)
  };
};
