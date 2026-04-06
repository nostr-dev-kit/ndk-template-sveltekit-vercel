import { browser } from '$app/environment';
import {
  NDKNip46Signer,
  type NDKEvent,
  type NDKUser,
  type NDKUserProfile
} from '@nostr-dev-kit/ndk';
import QRCode from 'qrcode';
import { APP_NAME } from '$lib/ndk/config';
import { cleanText, displayName, profileIdentifier } from '$lib/ndk/format';
import { interestTagsFromEvent, onboardingComplete } from '$lib/onboarding';

const NOSTR_CONNECT_RELAY = 'wss://relay.nsec.app';

export type LoginIntent = 'login' | 'join';
export type LoginMode = 'extension' | 'private-key' | 'remote';

type NostrConnectNdk = Parameters<typeof NDKNip46Signer.nostrconnect>[0];

export function hasNostrExtension(): boolean {
  return browser && typeof window !== 'undefined' && 'nostr' in window;
}

export function stopNostrConnectSigner(signer: NDKNip46Signer | null | undefined): void {
  signer?.stop();
}

export async function prepareRemoteSignerPairing(
  ndk: NostrConnectNdk
): Promise<{ signer: NDKNip46Signer; nostrConnectUri: string; qrCodeDataUrl: string }> {
  const signer = NDKNip46Signer.nostrconnect(ndk, NOSTR_CONNECT_RELAY, undefined, {
    name: APP_NAME
  });
  const nostrConnectUri = signer.nostrConnectUri || '';

  if (!nostrConnectUri) {
    stopNostrConnectSigner(signer);
    throw new Error("Couldn't create a connection QR code.");
  }

  const qrCodeDataUrl = await QRCode.toDataURL(nostrConnectUri, {
    width: 256,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#ffffff'
    }
  });

  return { signer, nostrConnectUri, qrCodeDataUrl };
}

export async function fetchResolvedProfile(user: NDKUser): Promise<NDKUserProfile | undefined> {
  if (user.profile) {
    return user.profile;
  }

  try {
    return (await user.fetchProfile()) ?? user.profile ?? undefined;
  } catch {
    return user.profile ?? undefined;
  }
}

export function authUserLabel(profile: NDKUserProfile | undefined): string {
  return displayName(profile, '') || cleanText(profile?.nip05) || 'Signed in';
}

export function authProfileHref(profile: NDKUserProfile | undefined, npub: string): string {
  return `/profile/${profileIdentifier(profile, npub)}`;
}

export function needsOnboarding(args: {
  user: NDKUser | null | undefined;
  profile: NDKUserProfile | undefined;
  isReadOnly: boolean;
  interestEvent: NDKEvent | null | undefined;
}): boolean {
  if (!args.user || args.isReadOnly) {
    return false;
  }

  return !onboardingComplete({
    profile: args.profile,
    interests: interestTagsFromEvent(args.interestEvent)
  });
}
