import type { NostrEvent } from '@nostr-dev-kit/ndk';
import type { PageServerLoad } from './$types';
import { fetchRecentHighlights, fetchHighlightedArticles } from '$lib/server/nostr';

export const load: PageServerLoad = async ({ setHeaders }) => {
  setHeaders({
    'cache-control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=3600'
  });

  try {
    const highlights = await fetchRecentHighlights(100);
    const articles = await fetchHighlightedArticles(highlights);

    return {
      highlights: highlights.map((event) => event.rawEvent() as NostrEvent),
      articles: articles.map((event) => event.rawEvent() as NostrEvent)
    };
  } catch (error) {
    console.warn('Highlights SSR load failed', error);

    return {
      highlights: [],
      articles: []
    };
  }
};
