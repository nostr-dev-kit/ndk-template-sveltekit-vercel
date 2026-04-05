import type { NostrEvent } from '@nostr-dev-kit/ndk';
import type { PageServerLoad } from './$types';
import { buildHomeSeo } from '$lib/seo';
import { fetchRecentArticles } from '$lib/server/nostr';

export const load: PageServerLoad = async ({ setHeaders, url }) => {
  setHeaders({
    'cache-control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=3600'
  });

  try {
    const articles = await fetchRecentArticles(9);

    return {
      articles: articles.map((event) => event.rawEvent() as NostrEvent),
      seo: buildHomeSeo(url)
    };
  } catch (error) {
    console.warn('Home SSR load failed', error);

    return {
      articles: [],
      seo: buildHomeSeo(url)
    };
  }
};
