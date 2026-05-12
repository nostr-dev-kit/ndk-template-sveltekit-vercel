import type { PageServerLoad } from './$types';
import { fetchTenexProjects } from '$lib/server/tenex';
import { fetchProfilesByPubkeys } from '$lib/server/nostr';
import { buildProjectsSeo } from '$lib/seo';

export const load: PageServerLoad = async ({ setHeaders, url }) => {
  setHeaders({
    'cache-control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=3600'
  });

  try {
    const projects = await fetchTenexProjects();
    const profiles = await fetchProfilesByPubkeys(projects.map((p) => p.pubkey));

    return {
      projects,
      profiles,
      seo: buildProjectsSeo(url)
    };
  } catch (error) {
    console.warn('Projects SSR load failed', error);
    return {
      projects: [],
      profiles: {},
      seo: buildProjectsSeo(url)
    };
  }
};
