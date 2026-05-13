import type { PageServerLoad } from './$types';
import { fetchTenexProjectByAddress } from '$lib/server/tenex';
import { decodeProjectNaddr } from '$lib/ndk/tenex';
import { buildMissingSeo, buildProjectSeo } from '$lib/seo';

export const load: PageServerLoad = async ({ params, setHeaders, url }) => {
  setHeaders({
    'cache-control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=3600'
  });

  const decoded = decodeProjectNaddr(params.naddr);

  if (!decoded) {
    return {
      missing: true,
      naddr: params.naddr,
      seo: buildMissingSeo(url, 'Project not found')
    };
  }

  try {
    const project = await fetchTenexProjectByAddress(decoded.pubkey, decoded.dTag);

    if (!project) {
      return {
        missing: true,
        naddr: params.naddr,
        seo: buildMissingSeo(url, 'Project not found')
      };
    }

    return {
      missing: false,
      naddr: params.naddr,
      project,
      seo: buildProjectSeo({
        url,
        title: project.title,
        description: project.description
      })
    };
  } catch (error) {
    console.warn('Project SSR load failed', error);
    return {
      missing: true,
      naddr: params.naddr,
      seo: buildMissingSeo(url, 'Project unavailable')
    };
  }
};
