import type { NDKEvent, NostrEvent } from '@nostr-dev-kit/ndk';
import { nip19 } from '@nostr-dev-kit/ndk';
import { cleanText, truncate } from './format';

export const KIND_PROJECT = 31933;
export const KIND_CONVERSATION_METADATA = 513;
export const KIND_MESSAGE = 1;

export type TenexAgent = {
  pubkey: string;
  slug?: string;
  role?: string;
};

export type TenexModel = {
  name: string;
  assignedAgentSlug?: string;
};

export type TenexTool = {
  name: string;
  assignedAgentSlug?: string;
};

export type TenexProject = {
  pubkey: string;
  dTag: string;
  address: string;
  naddr: string;
  title: string;
  description: string;
  picture?: string;
  agents: TenexAgent[];
  models: TenexModel[];
  tools: TenexTool[];
  createdAt: number;
};

export type TenexConversationMeta = {
  rootId: string;
  projectAddress: string;
  title: string;
  summary: string;
  statusLabel?: string;
  statusActivity?: string;
  updatedAt: number;
};

type EventLike = Pick<NostrEvent, 'tags' | 'content' | 'pubkey' | 'kind' | 'created_at'> & {
  id?: string;
};

function tagValue(tags: string[][], name: string): string | undefined {
  return tags.find((tag) => tag[0] === name)?.[1];
}

export function parseProjectEvent(event: NDKEvent | NostrEvent): TenexProject | undefined {
  const tags = event.tags ?? [];
  if (tags.some((tag) => tag[0] === 'deleted')) return undefined;

  const dTag = cleanText(tagValue(tags, 'd'));
  if (!dTag) return undefined;

  const pubkey = (event as NostrEvent).pubkey;
  if (!pubkey) return undefined;

  const address = `${KIND_PROJECT}:${pubkey}:${dTag}`;
  const titleTag = cleanText(tagValue(tags, 'title')) || cleanText(tagValue(tags, 'name'));
  const description = cleanText((event as NostrEvent).content);

  return {
    pubkey,
    dTag,
    address,
    naddr: encodeProjectNaddr({ pubkey, dTag }),
    title: titleTag || dTag,
    description,
    picture: cleanText(tagValue(tags, 'picture')) || cleanText(tagValue(tags, 'image')) || undefined,
    agents: parseAgents(tags),
    models: parseModels(tags),
    tools: parseTools(tags),
    createdAt: (event as NostrEvent).created_at ?? 0
  };
}

export function parseAgents(tags: string[][]): TenexAgent[] {
  const byPubkey = new Map<string, TenexAgent>();

  for (const tag of tags) {
    if (tag[0] !== 'p' || !tag[1]) continue;
    if (byPubkey.has(tag[1])) continue;
    byPubkey.set(tag[1], { pubkey: tag[1] });
  }

  for (const tag of tags) {
    if (tag[0] !== 'agent' || !tag[1]) continue;
    byPubkey.set(tag[1], {
      pubkey: tag[1],
      slug: cleanText(tag[2]) || undefined,
      role: cleanText(tag[3]) || undefined
    });
  }

  return Array.from(byPubkey.values());
}

export function parseModels(tags: string[][]): TenexModel[] {
  return tags
    .filter((tag) => tag[0] === 'model' && tag[1])
    .map((tag) => ({
      name: tag[1],
      assignedAgentSlug: cleanText(tag[2]) || undefined
    }));
}

export function parseTools(tags: string[][]): TenexTool[] {
  return tags
    .filter((tag) => tag[0] === 'tool' && tag[1])
    .map((tag) => ({
      name: tag[1],
      assignedAgentSlug: cleanText(tag[2]) || undefined
    }));
}

export function parseConversationMetadata(
  event: NDKEvent | NostrEvent
): TenexConversationMeta | undefined {
  const tags = event.tags ?? [];
  const rootId = cleanText(tagValue(tags, 'e'));
  const projectAddress = cleanText(tagValue(tags, 'a'));
  if (!rootId || !projectAddress) return undefined;

  return {
    rootId,
    projectAddress,
    title: cleanText(tagValue(tags, 'title')) || 'Untitled conversation',
    summary: cleanText(tagValue(tags, 'summary')) || '',
    statusLabel: cleanText(tagValue(tags, 'status-label')) || undefined,
    statusActivity: cleanText(tagValue(tags, 'status-current-activity')) || undefined,
    updatedAt: (event as NostrEvent).created_at ?? 0
  };
}

export function parseProjectAddress(
  address: string | undefined
): { kind: number; pubkey: string; dTag: string } | undefined {
  if (!address) return undefined;
  const parts = address.split(':');
  if (parts.length < 3) return undefined;
  const kind = Number(parts[0]);
  const pubkey = parts[1];
  const dTag = parts.slice(2).join(':');
  if (!Number.isInteger(kind) || !Number.isFinite(kind) || !pubkey || !dTag) return undefined;
  return { kind, pubkey, dTag };
}

export function encodeProjectNaddr(args: { pubkey: string; dTag: string }): string {
  return nip19.naddrEncode({
    kind: KIND_PROJECT,
    pubkey: args.pubkey,
    identifier: args.dTag
  });
}

export function decodeProjectNaddr(naddr: string):
  | { pubkey: string; dTag: string; address: string }
  | undefined {
  try {
    const decoded = nip19.decode(naddr);
    if (decoded.type !== 'naddr') return undefined;
    const data = decoded.data;
    if (data.kind !== KIND_PROJECT) return undefined;
    return {
      pubkey: data.pubkey,
      dTag: data.identifier,
      address: `${KIND_PROJECT}:${data.pubkey}:${data.identifier}`
    };
  } catch {
    return undefined;
  }
}

export function isAgentPubkey(pubkey: string, agents: TenexAgent[]): boolean {
  return agents.some((agent) => agent.pubkey === pubkey);
}

export function findAgent(pubkey: string, agents: TenexAgent[]): TenexAgent | undefined {
  return agents.find((agent) => agent.pubkey === pubkey);
}

export function modelForAgentSlug(slug: string | undefined, models: TenexModel[]): string | undefined {
  if (!slug) return undefined;
  return models.find((model) => model.assignedAgentSlug === slug)?.name;
}

export function projectMessageSummary(content: string, max = 220): string {
  const stripped = cleanText(
    content
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/`[^`]*`/g, ' ')
      .replace(/^\s{0,3}#{1,6}\s+/gm, '')
      .replace(/^\s*>\s?/gm, '')
      .replace(/^\s*[-*+]\s+/gm, '')
      .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
      .replace(/[*_~]+/g, '')
  );
  return truncate(stripped, max);
}

export function relativeTime(seconds: number | undefined): string {
  if (!seconds) return '';
  const diff = Math.floor(Date.now() / 1000 - seconds);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86_400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 2_592_000) return `${Math.floor(diff / 86_400)}d ago`;
  if (diff < 31_536_000) return `${Math.floor(diff / 2_592_000)}mo ago`;
  return `${Math.floor(diff / 31_536_000)}y ago`;
}

export function sortConversationsByRecent<T extends { updatedAt: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => b.updatedAt - a.updatedAt);
}

export function sortMessagesChronologically(events: NDKEvent[]): NDKEvent[] {
  return [...events].sort((a, b) => (a.created_at ?? 0) - (b.created_at ?? 0));
}

export function latestByRoot(events: EventLike[]): EventLike | undefined {
  if (events.length === 0) return undefined;
  return events.reduce((latest, current) =>
    (current.created_at ?? 0) > (latest.created_at ?? 0) ? current : latest
  );
}
