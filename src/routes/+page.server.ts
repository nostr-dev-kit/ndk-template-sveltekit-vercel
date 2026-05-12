import type { PageServerLoad } from './$types';
import { fetchTenexProjects } from '$lib/server/tenex';
import { fetchProfilesByPubkeys } from '$lib/server/nostr';
import { buildHomeSeo } from '$lib/seo';

const FEATURED_PROJECT_LIMIT = 4;

export const load: PageServerLoad = async ({ setHeaders, url }) => {
  setHeaders({
    'cache-control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=3600'
  });

  try {
    const projects = await fetchTenexProjects();
    const featured = projects.slice(0, FEATURED_PROJECT_LIMIT);
    const profiles = await fetchProfilesByPubkeys(featured.map((project) => project.pubkey));

    return {
      featuredProjects: featured,
      profiles,
      seo: buildHomeSeo(url)
    };
  } catch (error) {
    console.warn('Landing page SSR load failed', error);
    return {
      featuredProjects: [],
      profiles: {},
      seo: buildHomeSeo(url)
    };
  }
};
