import type { PageServerLoad } from './$types';
import { fetchUserWithProfile } from '$lib/server/nostr';
import { buildMissingSeo, buildProfileSeo } from '$lib/seo';

export const load: PageServerLoad = async ({ params, setHeaders, url }) => {
  setHeaders({
    'cache-control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=3600'
  });

  try {
    const { user, profile } = await fetchUserWithProfile(params.identifier);

    if (!user) {
      return {
        missing: true,
        identifier: params.identifier,
        seo: buildMissingSeo(url, 'Profile not found')
      };
    }

    return {
      missing: false,
      identifier: params.identifier,
      pubkey: user.pubkey,
      npub: user.npub,
      profile,
      seo: buildProfileSeo({
        url,
        pubkey: user.pubkey,
        profile
      })
    };
  } catch (error) {
    console.warn('Profile SSR load failed', error);

    return {
      missing: true,
      identifier: params.identifier,
      seo: buildMissingSeo(url, 'Profile unavailable')
    };
  }
};
