import type NDK from '@nostr-dev-kit/ndk';
import {
  NDKEvent,
  NDKKind,
  type NDKRelay,
  type NDKSigner
} from '@nostr-dev-kit/ndk';

export async function createRelayAuthEvent(
  ndk: NDK,
  signer: NDKSigner,
  relay: NDKRelay,
  challenge: string
): Promise<NDKEvent> {
  const event = new NDKEvent(ndk);
  event.kind = NDKKind.ClientAuth;
  event.tags = [
    ['relay', relay.url],
    ['challenge', challenge]
  ];
  await event.sign(signer);
  return event;
}
