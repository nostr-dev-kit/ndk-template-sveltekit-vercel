import type { NDKUserProfile, NostrEvent } from '@nostr-dev-kit/ndk';

type EventWithContent = Pick<NostrEvent, 'content' | 'tags'>;
type EventWithTiming = Pick<NostrEvent, 'content' | 'tags' | 'created_at'>;

export function shortPubkey(pubkey: string): string {
  if (pubkey.length <= 16) return pubkey;
  return `${pubkey.slice(0, 8)}...${pubkey.slice(-8)}`;
}

export function displayName(profile: NDKUserProfile | undefined, fallback: string): string {
  const candidate =
    cleanText(profile?.displayName) ||
    cleanText(profile?.name) ||
    cleanText(profile?.nip05) ||
    fallback;

  return candidate;
}

export function noteTitle(event: Pick<NostrEvent, 'content' | 'tags'>): string {
  const titleTag = event.tags.find((tag) => tag[0] === 'title')?.[1];
  const fromTag = cleanText(titleTag);
  if (fromTag) return fromTag;

  const firstLine = cleanText(event.content.split('\n').find((line) => line.trim().length > 0));
  if (firstLine) return truncate(firstLine, 84);

  return 'Untitled note';
}

export function noteExcerpt(content: string, maxLength = 220): string {
  const normalized = cleanText(
    content
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
      .replace(/\s+/g, ' ')
  );

  return truncate(normalized || 'A note shared over Nostr.', maxLength);
}

export function articleTitle(event: EventWithContent): string {
  return noteTitle(event);
}

export function articleSummary(event: EventWithTiming, maxLength = 220): string {
  const summary = cleanText(tagValue(event.tags, 'summary'));
  return summary || noteExcerpt(event.content, maxLength);
}

export function articleTopics(event: Pick<NostrEvent, 'tags'>, limit = 4): string[] {
  const topics = event.tags
    .filter((tag) => tag[0] === 't')
    .map((tag) => cleanText(tag[1]))
    .filter(Boolean);

  return [...new Set(topics)].slice(0, limit);
}

export function articlePublishedAt(event: EventWithTiming): Date | undefined {
  const publishedAt = Number(tagValue(event.tags, 'published_at'));
  if (Number.isFinite(publishedAt) && publishedAt > 0) {
    return new Date(publishedAt * 1000);
  }

  if (event.created_at) {
    return new Date(event.created_at * 1000);
  }

  return undefined;
}

export function articleWordCount(content: string): number {
  const words = cleanText(content).split(' ').filter(Boolean);
  return words.length;
}

export function articleReadTimeMinutes(content: string): number {
  return Math.max(1, Math.round(articleWordCount(content) / 220));
}

export function formatDisplayDate(date: Date | undefined): string {
  if (!date) return 'Undated';

  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(date);
}

export function cleanText(value: string | null | undefined): string {
  return typeof value === 'string'
    ? value.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim()
    : '';
}

export function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
}

export function avatarUrl(profile: NDKUserProfile | undefined): string | undefined {
  const candidate = cleanText(profile?.picture) || cleanText(profile?.image);
  return candidate || undefined;
}

function tagValue(tags: string[][], name: string): string | undefined {
  return tags.find((tag) => tag[0] === name)?.[1];
}
