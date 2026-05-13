import { browser } from '$app/environment';
import {
  NDKBlossomList,
  NDKInterestList,
  NDKPrivateKeySigner,
  type NDKRelay
} from '@nostr-dev-kit/ndk';
import { createNDK } from '@nostr-dev-kit/svelte';
import { LocalStorage } from '@nostr-dev-kit/sessions';
import { APP_NAME, DEFAULT_RELAYS } from '$lib/ndk/config';
import { createRelayAuthEvent } from '$lib/ndk/auth';

const EPHEMERAL_KEY = 'open-prompt:ephemeral-key';
const PROTECTED_RELAY_PATTERN = 'relay.tenex.chat';
let ephemeralSigner: NDKPrivateKeySigner | undefined;

function getEphemeralSigner(): NDKPrivateKeySigner {
  if (ephemeralSigner) return ephemeralSigner;

  if (browser) {
    try {
      const stored = sessionStorage.getItem(EPHEMERAL_KEY);
      if (stored) {
        ephemeralSigner = new NDKPrivateKeySigner(stored);
        return ephemeralSigner;
      }
    } catch {
      try {
        sessionStorage.removeItem(EPHEMERAL_KEY);
      } catch {
        /* ignore */
      }
    }
  }

  ephemeralSigner = NDKPrivateKeySigner.generate();
  if (browser) {
    try {
      sessionStorage.setItem(EPHEMERAL_KEY, ephemeralSigner.privateKey);
    } catch {
      /* storage blocked — use in-memory only */
    }
  }

  return ephemeralSigner;
}

export const ndk = createNDK({
  explicitRelayUrls: DEFAULT_RELAYS,
  clientName: APP_NAME,
  enableOutboxModel: false,
  session: {
    storage: new LocalStorage('ndk-sveltekit-template:sessions'),
    autoSave: true,
    fetches: {
      follows: true,
      mutes: true,
      relayList: true,
      wallet: false,
      monitor: [NDKInterestList, NDKBlossomList]
    }
  }
});

ndk.relayAuthDefaultPolicy = async (relay: NDKRelay, challenge: string) => {
  const signer = ndk.signer ?? getEphemeralSigner();
  return createRelayAuthEvent(ndk, signer, relay, challenge);
};

let connectPromise: Promise<void> | null = null;

export function ensureClientNdk(): Promise<void> {
  if (!browser) return Promise.resolve();
  if (!connectPromise) {
    connectPromise = ndk.connect().then(() => undefined).catch((error) => {
      connectPromise = null;
      throw error;
    });
  }

  return connectPromise;
}

export async function reauthProtectedRelays(): Promise<void> {
  if (!browser) return;
  for (const relay of ndk.pool.relays.values()) {
    if (!relay.url.includes(PROTECTED_RELAY_PATTERN)) continue;
    relay.disconnect();
    try {
      await relay.connect();
    } catch (error) {
      console.warn(`Failed to reconnect to ${relay.url}`, error);
    }
  }
}
