import type { NostrEvent } from '@nostr-dev-kit/ndk';
import type { PageServerLoad } from './$types';
import { fetchProfilesByPubkeys } from '$lib/server/nostr';
import {
  fetchEventsByIds,
  fetchProjectConversations,
  fetchTenexProjectByAddress,
  rawEventList
} from '$lib/server/tenex';
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

    const [conversations, profiles] = await Promise.all([
      fetchProjectConversations(project.address),
      fetchProfilesByPubkeys([project.pubkey, ...project.agents.map((agent) => agent.pubkey)])
    ]);

    const rootIds = conversations.map((meta) => meta.rootId);
    const rootEvents = await fetchEventsByIds(rootIds);
    const ownedRootEvents = rootEvents.filter((event) => event.pubkey === project.pubkey);
    const rawRootEvents: NostrEvent[] = rawEventList(ownedRootEvents);
    const ownedRootIds = new Set(ownedRootEvents.map((event) => event.id));
    const ownedConversations = conversations.filter((meta) => ownedRootIds.has(meta.rootId));

    return {
      missing: false,
      naddr: params.naddr,
      project,
      conversations: ownedConversations,
      rootEvents: rawRootEvents,
      profiles,
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
