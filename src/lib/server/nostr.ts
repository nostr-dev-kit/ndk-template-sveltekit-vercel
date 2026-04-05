import NDK, {
  type NDKEvent,
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

function publishedAtSeconds(event: Pick<NDKEvent, 'created_at' | 'tags'>): number {
  const publishedTag = event.tags.find((tag) => tag[0] === 'published_at')?.[1];
  const publishedAt = Number(publishedTag);

  if (Number.isFinite(publishedAt) && publishedAt > 0) {
    return publishedAt;
  }

  return event.created_at ?? 0;
}
