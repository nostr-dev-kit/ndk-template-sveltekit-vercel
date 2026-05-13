import NDK, {
  NDKPrivateKeySigner,
  type NDKRelay,
  type NDKUser,
  type NDKUserProfile
} from '@nostr-dev-kit/ndk';
import { APP_NAME, DEFAULT_RELAYS } from '$lib/ndk/config';
import { createRelayAuthEvent } from '$lib/ndk/auth';
import { getServerCacheAdapter } from '$lib/server/ndk-cache';

const CONNECT_TIMEOUT_MS = 2500;
const FETCH_TIMEOUT_MS = 2500;
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
  const authSigner = NDKPrivateKeySigner.generate();
  const ndk = new NDK({
    explicitRelayUrls: [...relays],
    clientName: APP_NAME,
    enableOutboxModel: false,
    ...(cacheAdapter ? { cacheAdapter } : {})
  });

  ndk.relayAuthDefaultPolicy = async (relay: NDKRelay, challenge: string) => {
    return createRelayAuthEvent(ndk, authSigner, relay, challenge);
  };

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
