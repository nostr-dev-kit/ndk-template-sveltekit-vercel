import type { NDKUserProfile } from '@nostr-dev-kit/ndk';
import { APP_NAME, APP_TAGLINE } from '$lib/ndk/config';
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
    title: `About ${SITE_NAME}`,
    description:
      'Learn how Open Prompt surfaces the human prompts behind AI-built software.',
    canonical: canonicalUrl(url),
    type: 'website',
    image: defaultImage(url, `${SITE_NAME} preview`)
  };
}

export function buildOnboardingSeo(url: URL): SeoMetadata {
  return {
    title: `Set up your profile • ${SITE_NAME}`,
    description:
      'Create your profile, choose your interests, and upload an avatar for Open Prompt.',
    canonical: canonicalUrl(url),
    type: 'website',
    image: defaultImage(url, `${SITE_NAME} onboarding preview`)
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
    title: `${name} • ${SITE_NAME}`,
    description: about || `${name}'s profile and recent writing on ${SITE_NAME}.`,
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
    title: `Projects • ${SITE_NAME}`,
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
  const description = cleanSnippet(args.description) || `Conversations behind ${args.title}.`;
  return {
    title: `${args.title} • ${SITE_NAME}`,
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
}): SeoMetadata {
  const description = cleanSnippet(args.summary) || `Conversation thread on ${SITE_NAME}.`;
  return {
    title: `${args.title} • ${SITE_NAME}`,
    description,
    canonical: canonicalUrl(args.url),
    type: 'article',
    image: defaultImage(args.url, `${args.title} conversation preview`)
  };
}

export function buildMissingSeo(url: URL, label: string): SeoMetadata {
  return {
    title: `${label} • ${SITE_NAME}`,
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

