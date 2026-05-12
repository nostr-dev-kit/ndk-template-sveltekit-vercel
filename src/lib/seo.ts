import type { NDKUserProfile } from '@nostr-dev-kit/ndk';
import { APP_NAME } from '$lib/ndk/config';
import {
  avatarUrl,
  cleanText,
  displayNip05,
  displayName,
  truncate
} from '$lib/ndk/format';

export const SITE_NAME = APP_NAME;
export const DEFAULT_SOCIAL_IMAGE_PATH = '/og-default.png';
export const DEFAULT_SOCIAL_IMAGE_WIDTH = 1200;
export const DEFAULT_SOCIAL_IMAGE_HEIGHT = 630;

const HOME_DESCRIPTION =
  'View source for the age of AI-built software. Browse the human prompts that built real products.';

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
    title: `${SITE_NAME} — The source code is now English`,
    description: HOME_DESCRIPTION,
    canonical: canonicalUrl(url),
    type: 'website',
    image: defaultImage(url, `${SITE_NAME} preview`)
  };
}

export function buildAboutSeo(url: URL): SeoMetadata {
  return {
    title: `About — ${SITE_NAME}`,
    description:
      'Why Open Prompt exists: source code is now English, and the prompts that built each product are the real artifact.',
    canonical: canonicalUrl(url),
    type: 'website',
    image: defaultImage(url, `${SITE_NAME} preview`)
  };
}

export function buildProfileSeo(args: {
  url: URL;
  pubkey: string;
  profile?: NDKUserProfile;
}): SeoMetadata {
  const name = displayName(args.profile, 'Author');
  const about = cleanSnippet(args.profile?.about || args.profile?.bio);
  const imageUrl = avatarUrl(args.profile);

  return {
    title: `${name} — ${SITE_NAME}`,
    description: about || `${name} on ${SITE_NAME}.`,
    canonical: canonicalUrl(args.url),
    type: 'profile',
    image: imageUrl
      ? {
          url: imageUrl,
          alt: `${name} profile picture`
        }
      : defaultImage(args.url, `${name} profile preview`),
    author: name,
    username: cleanText(args.profile?.name) || displayNip05(args.profile) || undefined
  };
}

export function buildProjectsSeo(url: URL): SeoMetadata {
  return {
    title: `Projects — ${SITE_NAME}`,
    description: 'Browse TENEX projects and the human prompts that built them.',
    canonical: canonicalUrl(url),
    type: 'website',
    image: defaultImage(url, `${SITE_NAME} projects preview`)
  };
}

export function buildProjectSeo(args: {
  url: URL;
  title: string;
  description: string;
}): SeoMetadata {
  const description =
    cleanSnippet(args.description) ||
    `Browse conversations from ${args.title} on ${SITE_NAME}.`;
  return {
    title: `${args.title} — ${SITE_NAME}`,
    description,
    canonical: canonicalUrl(args.url),
    type: 'website',
    image: defaultImage(args.url, `${args.title} project preview`)
  };
}

export function buildConversationSeo(args: {
  url: URL;
  title: string;
  summary: string;
  projectTitle?: string;
}): SeoMetadata {
  const description =
    cleanSnippet(args.summary) ||
    (args.projectTitle
      ? `A conversation from ${args.projectTitle} on ${SITE_NAME}.`
      : `A conversation on ${SITE_NAME}.`);
  return {
    title: `${args.title} — ${SITE_NAME}`,
    description,
    canonical: canonicalUrl(args.url),
    type: 'article',
    image: defaultImage(args.url, `${args.title} conversation preview`)
  };
}

export function buildRelaysSeo(url: URL): SeoMetadata {
  return {
    title: `Relays — ${SITE_NAME}`,
    description:
      'Discover the Nostr relays where Open Prompt fetches projects, prompts, and conversations.',
    canonical: canonicalUrl(url),
    type: 'website',
    image: defaultImage(url, `${SITE_NAME} relays preview`)
  };
}

export function buildMissingSeo(url: URL, label: string): SeoMetadata {
  return {
    title: `${label} — ${SITE_NAME}`,
    description: 'The page you requested is not available right now.',
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
  const normalized = cleanText(value);
  if (!normalized || normalized === '~' || normalized === '-' || normalized === '_') {
    return undefined;
  }
  return truncate(normalized, 180) || undefined;
}

