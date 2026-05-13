import { browser } from '$app/environment';
import {
  NDKBlossomList,
  NDKEvent,
  NDKInterestList,
  NDKKind,
  NDKPrivateKeySigner,
  type NDKRelay
} from '@nostr-dev-kit/ndk';
import { createNDK } from '@nostr-dev-kit/svelte';
import { LocalStorage } from '@nostr-dev-kit/sessions';
import { APP_NAME, DEFAULT_RELAYS } from '$lib/ndk/config';

const EPHEMERAL_KEY = 'open-prompt:ephemeral-key';
let ephemeralSigner: NDKPrivateKeySigner | undefined;

function getEphemeralSigner(): NDKPrivateKeySigner {
  if (ephemeralSigner) return ephemeralSigner;

  const stored = browser ? sessionStorage.getItem(EPHEMERAL_KEY) : null;
  if (stored) {
    ephemeralSigner = new NDKPrivateKeySigner(stored);
  } else {
    ephemeralSigner = NDKPrivateKeySigner.generate();
    if (browser) {
      sessionStorage.setItem(EPHEMERAL_KEY, ephemeralSigner.privateKey);
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
  const event = new NDKEvent(ndk);
  event.kind = NDKKind.ClientAuth;
  event.tags = [
    ['relay', relay.url],
    ['challenge', challenge]
  ];
  await event.sign(signer);
  return event;
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
