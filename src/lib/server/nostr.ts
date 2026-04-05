import NDK, {
  type NDKEvent,
  type NDKFilter,
  type NDKUser,
  type NDKUserProfile
} from '@nostr-dev-kit/ndk';
import { APP_NAME, DEFAULT_RELAYS } from '$lib/ndk/config';

const CONNECT_TIMEOUT_MS = 2500;
const clients = new Map<string, Promise<NDK>>();

export async function getServerNdk(relays: readonly string[] = DEFAULT_RELAYS): Promise<NDK> {
  const key = relays.join(',');
  const existing = clients.get(key);
  if (existing) return existing;

  const promise = (async () => {
    const ndk = new NDK({
      explicitRelayUrls: [...relays],
      clientName: APP_NAME,
      enableOutboxModel: false
    });

    await ndk.connect(CONNECT_TIMEOUT_MS);
    return ndk;
  })();

  clients.set(key, promise);

  try {
    return await promise;
  } catch (error) {
    clients.delete(key);
    throw error;
  }
}

export async function fetchUserWithProfile(identifier: string): Promise<{
  user?: NDKUser;
  profile?: NDKUserProfile;
}> {
  const ndk = await getServerNdk();
  const user = await ndk.fetchUser(identifier);
  if (!user) return {};

  const profile = user.profile ?? (await user.fetchProfile({ closeOnEose: true }).catch(() => null)) ?? undefined;

  return { user, profile };
}

export async function fetchRecentNotesByAuthor(pubkey: string, limit = 8): Promise<NDKEvent[]> {
  const ndk = await getServerNdk();
  const events = await ndk.fetchEvents(
    {
      kinds: [1],
      authors: [pubkey],
      limit
    },
    { closeOnEose: true }
  );

  return Array.from(events ?? []).sort((left, right) => (right.created_at ?? 0) - (left.created_at ?? 0));
}

export async function fetchRecentArticles(limit = 10): Promise<NDKEvent[]> {
  const ndk = await getServerNdk();
  const events = await ndk.fetchEvents(
    {
      kinds: [30023],
      limit
    },
    { closeOnEose: true }
  );

  return Array.from(events ?? []).sort(sortByPublishedTime);
}

export async function fetchCommentedArticles(
  limit = 10,
  pointerLimit = Math.max(limit * 8, 48)
): Promise<NDKEvent[]> {
  const ndk = await getServerNdk();
  const pointerEvents = Array.from(
    (await ndk.fetchEvents(
      {
        kinds: [1111],
        '#K': ['30023'],
        limit: pointerLimit
      },
      { closeOnEose: true }
    )) ?? []
  );

  if (pointerEvents.length === 0) {
    return [];
  }

  const { ids, addresses, pointersByReference } = collectPointerReferences(pointerEvents);
  const filters = buildPointedEventFilters(ids, addresses);

  if (filters.length === 0) {
    return [];
  }

  const targetEvents = Array.from((await ndk.fetchEvents(filters, { closeOnEose: true })) ?? []).filter(
    (event) => event.kind === 30023
  );

  const targetMetrics = new Map<string, { count: number; latestPointerTime: number }>();

  for (const event of targetEvents) {
    const pointers = collectPointersForTarget(event, pointersByReference);

    targetMetrics.set(event.tagId(), {
      count: pointers.length,
      latestPointerTime: Math.max(...pointers.map((pointer) => pointer.created_at ?? 0), 0)
    });
  }

  return targetEvents
    .sort((left, right) => {
      const leftMetrics = targetMetrics.get(left.tagId()) ?? { count: 0, latestPointerTime: 0 };
      const rightMetrics = targetMetrics.get(right.tagId()) ?? { count: 0, latestPointerTime: 0 };

      if (rightMetrics.count !== leftMetrics.count) {
        return rightMetrics.count - leftMetrics.count;
      }

      if (rightMetrics.latestPointerTime !== leftMetrics.latestPointerTime) {
        return rightMetrics.latestPointerTime - leftMetrics.latestPointerTime;
      }

      return sortByPublishedTime(left, right);
    })
    .slice(0, limit);
}

export async function fetchFrontPageArticles(limit = 10): Promise<NDKEvent[]> {
  const [commentedArticles, recentArticles] = await Promise.all([
    fetchCommentedArticles(limit),
    fetchRecentArticles(limit)
  ]);

  return mergeUniqueEvents(commentedArticles, recentArticles, limit);
}

export async function fetchRecentArticlesByAuthor(pubkey: string, limit = 8): Promise<NDKEvent[]> {
  const ndk = await getServerNdk();
  const events = await ndk.fetchEvents(
    {
      kinds: [30023],
      authors: [pubkey],
      limit
    },
    { closeOnEose: true }
  );

  return Array.from(events ?? []).sort(sortByPublishedTime);
}

export async function fetchNoteWithAuthor(identifier: string): Promise<{
  event?: NDKEvent;
  author?: NDKUser;
  profile?: NDKUserProfile;
}> {
  const ndk = await getServerNdk();
  const event = await ndk.fetchEvent(identifier, { closeOnEose: true });
  if (!event) return {};

  const author = ndk.getUser({ pubkey: event.pubkey });
  const profile =
    author.profile ?? (await author.fetchProfile({ closeOnEose: true }).catch(() => null)) ?? undefined;

  return { event, author, profile };
}

function sortByPublishedTime(left: NDKEvent, right: NDKEvent): number {
  return publishedAtSeconds(right) - publishedAtSeconds(left);
}

function mergeUniqueEvents(primary: NDKEvent[], secondary: NDKEvent[], limit: number): NDKEvent[] {
  const merged: NDKEvent[] = [];
  const seen = new Set<string>();

  for (const event of [...primary, ...secondary]) {
    const key = event.tagId();
    if (seen.has(key)) continue;

    seen.add(key);
    merged.push(event);

    if (merged.length >= limit) {
      break;
    }
  }

  return merged;
}

function collectPointerReferences(pointerEvents: NDKEvent[]): {
  ids: Set<string>;
  addresses: Set<string>;
  pointersByReference: Map<string, NDKEvent[]>;
} {
  const ids = new Set<string>();
  const addresses = new Set<string>();
  const pointersByReference = new Map<string, NDKEvent[]>();

  for (const pointerEvent of pointerEvents) {
    const references = extractPointerReferences(pointerEvent);

    for (const reference of references) {
      if (reference.includes(':')) {
        addresses.add(reference);
      } else {
        ids.add(reference);
      }

      const pointers = pointersByReference.get(reference) ?? [];
      pointers.push(pointerEvent);
      pointersByReference.set(reference, pointers);
    }
  }

  return { ids, addresses, pointersByReference };
}

function extractPointerReferences(pointerEvent: NDKEvent): Set<string> {
  const references = new Set<string>();

  for (const tag of pointerEvent.getMatchingTags('e')) {
    const reference = tag[1]?.trim();
    if (reference) references.add(reference);
  }

  for (const tag of pointerEvent.getMatchingTags('a')) {
    const reference = tag[1]?.trim();
    if (reference) references.add(reference);
  }

  return references;
}

function buildPointedEventFilters(ids: Set<string>, addresses: Set<string>): NDKFilter[] {
  const filters: NDKFilter[] = [];

  if (ids.size > 0) {
    filters.push({ ids: Array.from(ids) });
  }

  if (addresses.size > 0) {
    const groupedAddresses = new Map<string, { kinds: Set<number>; dTags: Set<string> }>();

    for (const address of addresses) {
      const [kindString, pubkey, dTag] = address.split(':');
      const kind = Number.parseInt(kindString, 10);

      if (!Number.isFinite(kind) || !pubkey || dTag === undefined) {
        continue;
      }

      const group = groupedAddresses.get(pubkey) ?? { kinds: new Set<number>(), dTags: new Set<string>() };
      group.kinds.add(kind);
      group.dTags.add(dTag);
      groupedAddresses.set(pubkey, group);
    }

    for (const [pubkey, group] of groupedAddresses) {
      filters.push({
        kinds: Array.from(group.kinds),
        authors: [pubkey],
        '#d': Array.from(group.dTags)
      });
    }
  }

  return filters;
}

function collectPointersForTarget(
  target: NDKEvent,
  pointersByReference: Map<string, NDKEvent[]>
): NDKEvent[] {
  const pointers = new Map<string, NDKEvent>();

  for (const reference of targetReferences(target)) {
    for (const pointer of pointersByReference.get(reference) ?? []) {
      pointers.set(pointer.id, pointer);
    }
  }

  return Array.from(pointers.values());
}

function targetReferences(target: NDKEvent): Set<string> {
  const references = new Set<string>([target.tagId()]);

  if (target.id) {
    references.add(target.id);
  }

  return references;
}

function publishedAtSeconds(event: Pick<NDKEvent, 'created_at' | 'tags'>): number {
  const publishedTag = event.tags.find((tag) => tag[0] === 'published_at')?.[1];
  const publishedAt = Number(publishedTag);

  if (Number.isFinite(publishedAt) && publishedAt > 0) {
    return publishedAt;
  }

  return event.created_at ?? 0;
}
