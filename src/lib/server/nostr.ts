import NDK, {
  type NDKEvent,
  type NDKFilter,
  NDKSubscriptionCacheUsage,
  type NDKUser,
  type NDKUserProfile,
  profileFromEvent
} from '@nostr-dev-kit/ndk';
import { APP_NAME, DEFAULT_RELAYS } from '$lib/ndk/config';
import { getServerCacheAdapter } from '$lib/server/ndk-cache';

const CONNECT_TIMEOUT_MS = 2500;
const CACHE_FETCH_TIMEOUT_MS = 800;
const FETCH_TIMEOUT_MS = 2500;
const FRONT_PAGE_FETCH_TIMEOUT_MS = 6000;
const clients = new Map<string, ServerNdkClient>();

type ServerNdkClient = {
  ndk: NDK;
  connectPromise: Promise<void>;
};

export async function getServerNdk(
  relays: readonly string[] = DEFAULT_RELAYS,
  options: { connect?: boolean } = {}
): Promise<NDK> {
  const client = getServerNdkClient(relays);

  if (options.connect !== false) {
    await client.connectPromise;
  }

  return client.ndk;
}

function getServerNdkClient(relays: readonly string[] = DEFAULT_RELAYS): ServerNdkClient {
  const key = relays.join(',');
  const existing = clients.get(key);
  if (existing) return existing;

  const cacheAdapter = getServerCacheAdapter();
  const ndk = new NDK({
    explicitRelayUrls: [...relays],
    clientName: APP_NAME,
    enableOutboxModel: false,
    ...(cacheAdapter ? { cacheAdapter } : {})
  });

  const client: ServerNdkClient = {
    ndk,
    connectPromise: ndk.connect(CONNECT_TIMEOUT_MS).catch((error) => {
      clients.delete(key);
      throw error;
    })
  };

  clients.set(key, client);

  return client;
}

async function fetchEventsForSsr(
  filters: NDKFilter | NDKFilter[],
  label: string,
  timeoutMs = FETCH_TIMEOUT_MS
): Promise<Set<NDKEvent> | undefined> {
  const ndk = await getServerNdk(DEFAULT_RELAYS, { connect: false });
  const cachedEvents = await fetchEventsFromCache(ndk, filters, label);

  if (cachedEvents && cachedEvents.size > 0) {
    return cachedEvents;
  }

  await getServerNdk();

  return withTimeoutMs(
    ndk.fetchEvents(filters, {
      closeOnEose: true,
      cacheUsage: NDKSubscriptionCacheUsage.ONLY_RELAY
    }),
    undefined,
    label,
    timeoutMs
  );
}

async function fetchEventsFromCache(
  ndk: NDK,
  filters: NDKFilter | NDKFilter[],
  label: string
): Promise<Set<NDKEvent> | undefined> {
  if (!ndk.cacheAdapter) return undefined;

  return withTimeoutMs(
    ndk.fetchEvents(filters, {
      closeOnEose: true,
      cacheUsage: NDKSubscriptionCacheUsage.ONLY_CACHE
    }),
    undefined,
    `${label}:cache`,
    CACHE_FETCH_TIMEOUT_MS
  );
}

export async function fetchUserWithProfile(identifier: string): Promise<{
  user?: NDKUser;
  profile?: NDKUserProfile;
}> {
  const ndk = await getServerNdk(DEFAULT_RELAYS, { connect: false });
  const user = await withTimeout(ndk.fetchUser(identifier), undefined, `fetchUser(${identifier})`);
  if (!user) return {};

  const profile =
    user.profile ??
    (await withTimeout(
      user.fetchProfile({ closeOnEose: true }).catch(() => null),
      null,
      `fetchProfile(${identifier})`
    )) ??
    undefined;

  return { user, profile };
}

export async function fetchProfilesByPubkeys(
  pubkeys: readonly string[],
  timeoutMs = FRONT_PAGE_FETCH_TIMEOUT_MS
): Promise<Record<string, NDKUserProfile>> {
  const uniquePubkeys = [...new Set(pubkeys.map((pubkey) => pubkey.trim()).filter(Boolean))];

  if (uniquePubkeys.length === 0) {
    return {};
  }

  const profileEvents = Array.from(
    (await fetchEventsForSsr(
      {
        kinds: [0],
        authors: uniquePubkeys
      },
      `fetchProfilesByPubkeys(${uniquePubkeys.length})`,
      timeoutMs
    )) ?? []
  );
  const latestProfiles = new Map<string, NDKEvent>();

  for (const event of profileEvents) {
    const existing = latestProfiles.get(event.pubkey);
    if (!existing || (event.created_at ?? 0) > (existing.created_at ?? 0)) {
      latestProfiles.set(event.pubkey, event);
    }
  }

  return Object.fromEntries(
    Array.from(latestProfiles, ([pubkey, event]) => {
      try {
        return [pubkey, profileFromEvent(event)] as const;
      } catch {
        return undefined;
      }
    }).filter((entry): entry is readonly [string, NDKUserProfile] => Boolean(entry))
  );
}

async function withTimeout<T>(promise: Promise<T>, fallback: T, label: string): Promise<T> {
  return withTimeoutMs(promise, fallback, label, FETCH_TIMEOUT_MS);
}

async function withTimeoutMs<T>(
  promise: Promise<T>,
  fallback: T,
  label: string,
  timeoutMs: number
): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timeoutHandle = setTimeout(() => {
          console.warn(`${label} timed out after ${timeoutMs}ms`);
          resolve(fallback);
        }, timeoutMs);
      })
    ]);
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
}
