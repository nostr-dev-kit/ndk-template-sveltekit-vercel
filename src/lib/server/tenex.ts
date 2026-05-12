import type { NDKEvent, NDKFilter, NostrEvent } from '@nostr-dev-kit/ndk';
import { NDKSubscriptionCacheUsage } from '@nostr-dev-kit/ndk';
import { DEFAULT_RELAYS } from '$lib/ndk/config';
import { getServerNdk } from '$lib/server/nostr';
import {
  KIND_CONVERSATION_METADATA,
  KIND_MESSAGE,
  KIND_PROJECT,
  parseConversationMetadata,
  parseProjectEvent,
  type TenexConversationMeta,
  type TenexProject
} from '$lib/ndk/tenex';

const PABLO_PUBKEY = '09d48a1a5dbe13404a729634f1d6ba722d40513468dd713c8ea38ca9b7b6f2c7';
const FETCH_TIMEOUT_MS = 4000;
const CACHE_FETCH_TIMEOUT_MS = 800;

async function fetchEvents(
  filters: NDKFilter | NDKFilter[],
  label: string,
  timeoutMs = FETCH_TIMEOUT_MS
): Promise<NDKEvent[]> {
  const ndk = await getServerNdk(DEFAULT_RELAYS, { connect: false });

  const cached = ndk.cacheAdapter
    ? await withTimeout(
        ndk.fetchEvents(filters, {
          closeOnEose: true,
          cacheUsage: NDKSubscriptionCacheUsage.ONLY_CACHE
        }),
        undefined,
        `${label}:cache`,
        CACHE_FETCH_TIMEOUT_MS
      )
    : undefined;

  if (cached && cached.size > 0) {
    return Array.from(cached);
  }

  await getServerNdk();

  const events = await withTimeout(
    ndk.fetchEvents(filters, {
      closeOnEose: true,
      cacheUsage: NDKSubscriptionCacheUsage.ONLY_RELAY
    }),
    undefined,
    label,
    timeoutMs
  );

  return events ? Array.from(events) : [];
}

export async function fetchTenexProjects(limit = 60): Promise<TenexProject[]> {
  const filters: NDKFilter[] = [
    { kinds: [KIND_PROJECT], authors: [PABLO_PUBKEY], limit },
    { kinds: [KIND_PROJECT], limit }
  ];

  const events = await fetchEvents(filters, `fetchTenexProjects(${limit})`);

  const byAddress = new Map<string, TenexProject>();
  for (const event of events) {
    const project = parseProjectEvent(event);
    if (!project) continue;

    const existing = byAddress.get(project.address);
    if (!existing || project.createdAt > existing.createdAt) {
      byAddress.set(project.address, project);
    }
  }

  return Array.from(byAddress.values()).sort((a, b) => b.createdAt - a.createdAt);
}

export async function fetchTenexProjectByAddress(
  pubkey: string,
  dTag: string
): Promise<TenexProject | undefined> {
  const events = await fetchEvents(
    { kinds: [KIND_PROJECT], authors: [pubkey], '#d': [dTag], limit: 1 },
    `fetchTenexProjectByAddress(${pubkey}:${dTag})`
  );

  if (events.length === 0) return undefined;

  const sorted = events.sort((a, b) => (b.created_at ?? 0) - (a.created_at ?? 0));
  return parseProjectEvent(sorted[0]);
}

export async function fetchProjectConversations(
  projectAddress: string,
  limit = 80
): Promise<TenexConversationMeta[]> {
  const events = await fetchEvents(
    { kinds: [KIND_CONVERSATION_METADATA as number], '#a': [projectAddress], limit },
    `fetchProjectConversations(${projectAddress})`
  );

  const byRoot = new Map<string, TenexConversationMeta>();
  for (const event of events) {
    const meta = parseConversationMetadata(event);
    if (!meta) continue;

    const existing = byRoot.get(meta.rootId);
    if (!existing || meta.updatedAt > existing.updatedAt) {
      byRoot.set(meta.rootId, meta);
    }
  }

  return Array.from(byRoot.values()).sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function fetchConversationBundle(rootId: string): Promise<{
  root?: NDKEvent;
  messages: NDKEvent[];
  meta?: TenexConversationMeta;
}> {
  const filters: NDKFilter[] = [
    { ids: [rootId] },
    { kinds: [KIND_MESSAGE], '#e': [rootId], limit: 500 },
    { kinds: [KIND_CONVERSATION_METADATA as number], '#e': [rootId], limit: 20 }
  ];

  const events = await fetchEvents(filters, `fetchConversationBundle(${rootId})`);

  let root: NDKEvent | undefined;
  const messages: NDKEvent[] = [];
  const metaEvents: NDKEvent[] = [];

  for (const event of events) {
    if (event.id === rootId) {
      root = event;
      if (event.kind === KIND_MESSAGE) messages.push(event);
    } else if (event.kind === KIND_MESSAGE) {
      messages.push(event);
    } else if (event.kind === KIND_CONVERSATION_METADATA) {
      metaEvents.push(event);
    }
  }

  const metaEvent = metaEvents.sort(
    (a, b) => (b.created_at ?? 0) - (a.created_at ?? 0)
  )[0];

  return {
    root,
    messages,
    meta: metaEvent ? parseConversationMetadata(metaEvent) : undefined
  };
}

export function rawEventList(events: NDKEvent[]): NostrEvent[] {
  return events.map((event) => event.rawEvent() as NostrEvent);
}

async function withTimeout<T>(
  promise: Promise<T>,
  fallback: T,
  label: string,
  timeoutMs: number
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timer = setTimeout(() => {
          console.warn(`${label} timed out after ${timeoutMs}ms`);
          resolve(fallback);
        }, timeoutMs);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
