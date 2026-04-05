import type { NDKUserProfile, NostrEvent } from '@nostr-dev-kit/ndk';
import { APP_NAME, APP_TAGLINE } from '$lib/ndk/config';
import { avatarUrl, displayName, noteExcerpt, noteTitle, shortPubkey, truncate } from '$lib/ndk/format';

export const SITE_NAME = APP_NAME;
export const DEFAULT_SOCIAL_IMAGE_PATH = '/og-default.png';
export const DEFAULT_SOCIAL_IMAGE_WIDTH = 1200;
export const DEFAULT_SOCIAL_IMAGE_HEIGHT = 630;

export type SeoImage = {
  url: string;
  alt: string;
  width?: number;
  height?: number;
};

export type SeoMetadata = {
  title: string;
  description: string;
  canonical: string;
  type?: string;
  image?: SeoImage;
  author?: string;
  username?: string;
  publishedTime?: string;
  robots?: string;
};

export function buildHomeSeo(url: URL): SeoMetadata {
  return {
    title: SITE_NAME,
    description: APP_TAGLINE,
    canonical: canonicalUrl(url),
    type: 'website',
    image: defaultImage(url, `${SITE_NAME} preview`)
  };
}

export function buildAboutSeo(url: URL): SeoMetadata {
  return {
    title: `About the Template • ${SITE_NAME}`,
    description:
      'A SvelteKit starter for long-form Nostr apps that need server-rendered routes, login, preview metadata, and a straightforward Vercel deployment path.',
    canonical: canonicalUrl(url),
    type: 'website',
    image: defaultImage(url, `${SITE_NAME} template preview`)
  };
}

export function buildProfileSeo(args: {
  url: URL;
  pubkey: string;
  profile?: NDKUserProfile;
}): SeoMetadata {
  const name = displayName(args.profile, shortPubkey(args.pubkey));
  const about = cleanSnippet(args.profile?.about || args.profile?.bio);
  const imageUrl = avatarUrl(args.profile);

  return {
    title: `${name} • ${SITE_NAME}`,
    description: about || `${name}'s Nostr profile and recent writing, rendered server-side with SvelteKit.`,
    canonical: canonicalUrl(args.url),
    type: 'profile',
    image: imageUrl
      ? {
          url: imageUrl,
          alt: `${name} profile picture`
        }
      : defaultImage(args.url, `${name} profile preview`),
    author: name,
    username: args.profile?.name || args.profile?.nip05 || undefined
  };
}

export function buildNoteSeo(args: {
  url: URL;
  event: NostrEvent;
  authorPubkey: string;
  profile?: NDKUserProfile;
}): SeoMetadata {
  const authorName = displayName(args.profile, shortPubkey(args.authorPubkey));
  const title = noteTitle(args.event);
  const description = truncate(`${authorName}: ${noteExcerpt(args.event.content, 180)}`, 190);

  return {
    title: `${title} • ${SITE_NAME}`,
    description,
    canonical: canonicalUrl(args.url),
    type: args.event.kind === 30023 ? 'article' : 'website',
    image: defaultImage(args.url, `${title} preview`),
    author: authorName,
    publishedTime: args.event.created_at
      ? new Date(args.event.created_at * 1000).toISOString()
      : undefined
  };
}

export function buildMissingSeo(url: URL, label: string): SeoMetadata {
  return {
    title: `${label} • ${SITE_NAME}`,
    description: `The requested resource could not be loaded from the configured Nostr relays.`,
    canonical: canonicalUrl(url),
    type: 'website',
    image: defaultImage(url, `${label} preview`),
    robots: 'noindex'
  };
}

function defaultImage(url: URL, alt: string): SeoImage {
  return {
    url: new URL(DEFAULT_SOCIAL_IMAGE_PATH, url.origin).toString(),
    alt,
    width: DEFAULT_SOCIAL_IMAGE_WIDTH,
    height: DEFAULT_SOCIAL_IMAGE_HEIGHT
  };
}

function canonicalUrl(url: URL): string {
  return new URL(url.pathname + url.search, url.origin).toString();
}

function cleanSnippet(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return truncate(value.replace(/\s+/g, ' ').trim(), 180) || undefined;
}
