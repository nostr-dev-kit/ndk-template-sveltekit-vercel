import type { NostrEvent } from '@nostr-dev-kit/ndk';
import type { PageServerLoad } from './$types';
import { fetchProfilesByPubkeys } from '$lib/server/nostr';
import { fetchConversationBundle, fetchTenexProjectByAddress, rawEventList } from '$lib/server/tenex';
import { KIND_PROJECT, parseProjectAddress } from '$lib/ndk/tenex';
import { buildConversationSeo, buildMissingSeo } from '$lib/seo';

export const load: PageServerLoad = async ({ params, setHeaders, url }) => {
  setHeaders({
    'cache-control': 'public, max-age=30, s-maxage=120, stale-while-revalidate=600'
  });

  try {
    const { root, messages, meta } = await fetchConversationBundle(params.id);

    if (!root && messages.length === 0 && !meta) {
      return {
        missing: true,
        rootId: params.id,
        seo: buildMissingSeo(url, 'Conversation not found')
      };
    }

    let projectAddress = meta?.projectAddress;
    if (!projectAddress && root) {
      projectAddress = root.tags.find((tag) => tag[0] === 'a')?.[1];
    }

    const projectRef = parseProjectAddress(projectAddress);
    const project =
      projectRef && projectRef.kind === KIND_PROJECT
        ? await fetchTenexProjectByAddress(projectRef.pubkey, projectRef.dTag)
        : undefined;

    const messagePubkeys = new Set<string>();
    if (root) messagePubkeys.add(root.pubkey);
    for (const message of messages) messagePubkeys.add(message.pubkey);
    if (project) {
      messagePubkeys.add(project.pubkey);
      for (const agent of project.agents) messagePubkeys.add(agent.pubkey);
    }

    const profiles = await fetchProfilesByPubkeys(Array.from(messagePubkeys));

    const title = meta?.title || (project ? `Conversation in ${project.title}` : 'Conversation');
    const summary = meta?.summary || '';

    const rawRoot = root ? (root.rawEvent() as NostrEvent) : undefined;
    const rawMessages = rawEventList(messages);

    return {
      missing: false,
      rootId: params.id,
      root: rawRoot,
      messages: rawMessages,
      meta: meta ?? undefined,
      project: project ?? undefined,
      profiles,
      seo: buildConversationSeo({ url, title, summary })
    };
  } catch (error) {
    console.warn('Conversation SSR load failed', error);
    return {
      missing: true,
      rootId: params.id,
      seo: buildMissingSeo(url, 'Conversation unavailable')
    };
  }
};
