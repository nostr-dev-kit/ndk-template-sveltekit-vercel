import { NDKBlossomList, type NDKEvent } from '@nostr-dev-kit/ndk';
import { cleanText } from '$lib/ndk/format';

export const DEFAULT_BLOSSOM_SERVER = 'https://blossom.primal.net';

export function parseBlossomServer(value: string | null | undefined): string | null {
  const candidate = cleanText(value);
  if (!candidate) return null;

  const withProtocol = /^[a-z]+:\/\//i.test(candidate) ? candidate : `https://${candidate}`;

  try {
    const url = new URL(withProtocol);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function blossomServerFromEvent(event: NDKEvent | null | undefined): string {
  const servers =
    event instanceof NDKBlossomList
      ? event.servers
      : (event?.tags ?? []).filter((tag) => tag[0] === 'server').map((tag) => tag[1] ?? '');

  return uniqueStrings(servers.map((server) => parseBlossomServer(server)).filter(Boolean))[0] ?? DEFAULT_BLOSSOM_SERVER;
}

export function mergeBlossomServers(primary: string, existing: string[]): string[] {
  return uniqueStrings([primary, ...existing].map((server) => parseBlossomServer(server)).filter(Boolean));
}

function uniqueStrings(values: (string | null | undefined)[]): string[] {
  return [...new Set(values.filter(Boolean) as string[])];
}
