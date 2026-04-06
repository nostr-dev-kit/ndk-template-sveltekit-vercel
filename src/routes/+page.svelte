<script lang="ts">
  import type { PageProps } from './$types';
  import { browser } from '$app/environment';
  import { NDKEvent, type NostrEvent } from '@nostr-dev-kit/ndk';
  import StoryAuthor from '$lib/components/StoryAuthor.svelte';
  import { ndk } from '$lib/ndk/client';
  import {
    articleImageUrl,
    articlePublishedAt,
    articleReadTimeMinutes,
    articleSummary,
    articleTitle,
    formatDisplayDate
  } from '$lib/ndk/format';

  let { data }: PageProps = $props();

  const recentArticles = ndk.$subscribe(() => {
    if (!browser) return undefined;

    return {
      filters: [{ kinds: [30023], limit: 12 }]
    };
  });

  const seedArticles = $derived((data.articles ?? []).map((event: NostrEvent) => new NDKEvent(ndk, event)));
  const liveArticles = $derived(mergeUniqueArticles(recentArticles.events, seedArticles, 12));
  const articles = $derived(liveArticles.length > 0 ? liveArticles : seedArticles);
  const featuredArticle = $derived.by(() =>
    articles.find((event) => Boolean(articleImageUrl(event.rawEvent())))
  );
  const featuredTitle = $derived(featuredArticle ? articleTitle(featuredArticle.rawEvent()) : '');
  const featuredImage = $derived(featuredArticle ? articleImageUrl(featuredArticle.rawEvent()) : undefined);
  const feedArticles = $derived.by(() => {
    const featuredId = featuredArticle?.tagId();
    if (!featuredId) return articles;
    return articles.filter((event) => event.tagId() !== featuredId);
  });

  let featuredImageLoaded = $state(false);

  $effect(() => {
    featuredImage;
    featuredImageLoaded = false;
  });

  function mergeUniqueArticles(primary: NDKEvent[], secondary: NDKEvent[], limit: number): NDKEvent[] {
    const merged: NDKEvent[] = [];
    const seen = new Set<string>();

    for (const event of [...primary, ...secondary]) {
      const key = event.tagId();
      if (seen.has(key)) continue;

      seen.add(key);
      merged.push(event);

      if (merged.length >= limit) {
        break;
      }
    }

    return merged;
  }
</script>

<section class="featured-story-section">
  {#if featuredArticle && featuredImage}
    <a class="featured-story" href={`/note/${featuredArticle.encode()}`}>
      <img
        class="featured-story-image"
        class:loaded={featuredImageLoaded}
        src={featuredImage}
        alt={featuredTitle}
        loading="eager"
        decoding="async"
        fetchpriority="high"
        onload={() => (featuredImageLoaded = true)}
      />

      <div class="featured-story-copy">
        <h1 class="featured-story-title">{featuredTitle}</h1>
        <p class="featured-story-summary">{articleSummary(featuredArticle.rawEvent(), 280)}</p>
        <div class="featured-story-meta">
          <StoryAuthor {ndk} pubkey={featuredArticle.pubkey} avatarClass="article-author-avatar article-author-avatar-compact" compact />
          <span class="story-pub-meta">
            <span>{formatDisplayDate(articlePublishedAt(featuredArticle.rawEvent()))}</span>
            <span>{articleReadTimeMinutes(featuredArticle.content)} min read</span>
          </span>
        </div>
      </div>
    </a>
  {:else if articles.length > 0}
    <div class="featured-story-empty">
      <h1>No featured story yet.</h1>
      <p class="muted">The lead story appears once an article ships with a tagged image.</p>
    </div>
  {:else}
    <div class="featured-story-empty">
      <h1>Waiting for the first story.</h1>
      <p class="muted">New writing will appear here as soon as stories are available.</p>
    </div>
  {/if}
</section>

{#if feedArticles.length > 0}
  <section class="article-feed">
    {#each feedArticles as event (event.id)}
      <a class="article-feed-item" href={`/note/${event.encode()}`}>
        <div class="article-feed-copy">
          <h3 class="article-feed-title">{articleTitle(event.rawEvent())}</h3>
          <p class="article-feed-summary">{articleSummary(event.rawEvent(), 180)}</p>
          <div class="article-feed-meta">
            <StoryAuthor
              {ndk}
              pubkey={event.pubkey}
              avatarClass="article-author-avatar article-author-avatar-compact"
              compact
            />
            <span class="story-pub-meta">
              <span>{formatDisplayDate(articlePublishedAt(event.rawEvent()))}</span>
              <span>{articleReadTimeMinutes(event.content)} min read</span>
            </span>
          </div>
        </div>

        {#if articleImageUrl(event.rawEvent())}
          <img class="article-feed-thumb" src={articleImageUrl(event.rawEvent())} alt="" loading="lazy" />
        {/if}
      </a>
    {/each}
  </section>
{/if}

<style>
  .featured-story-section {
    max-width: var(--content-width);
    margin: 0 auto;
  }

  .featured-story {
    display: block;
    color: inherit;
    text-decoration: none;
  }

  .featured-story-image {
    width: 100%;
    aspect-ratio: 16 / 9;
    object-fit: cover;
    border-radius: var(--radius-md);
    opacity: 0;
    transition: opacity 400ms ease;
  }

  .featured-story-image.loaded {
    opacity: 1;
  }

  .featured-story-copy {
    display: grid;
    gap: 0.75rem;
    padding: 1.5rem 0;
  }

  .featured-story-title {
    font-family: var(--font-serif);
    font-size: clamp(1.8rem, 4vw, 2.8rem);
    font-weight: 700;
    line-height: 1.1;
    letter-spacing: -0.02em;
    color: var(--text-strong);
    margin: 0;
    transition: color 160ms ease;
  }

  .featured-story:hover .featured-story-title {
    color: var(--accent);
  }

  .featured-story-summary {
    margin: 0;
    color: var(--muted);
    font-size: 1.05rem;
    line-height: 1.6;
    max-width: 56ch;
  }

  .featured-story-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem;
  }

  .featured-story-empty {
    display: grid;
    gap: 0.75rem;
    padding: 3rem 0;
  }

  .article-feed {
    max-width: var(--content-width);
    margin: 0 auto;
    display: grid;
  }

  .article-feed-item {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 1.5rem;
    align-items: start;
    padding: 1.5rem 0;
    border-bottom: 1px solid var(--border-light);
    color: inherit;
    text-decoration: none;
  }

  .article-feed-item:first-child {
    border-top: 1px solid var(--border-light);
  }

  .article-feed-copy {
    display: grid;
    gap: 0.5rem;
  }

  .article-feed-title {
    margin: 0;
    font-family: var(--font-serif);
    font-size: 1.35rem;
    font-weight: 700;
    color: var(--text-strong);
    line-height: 1.2;
    letter-spacing: -0.01em;
    transition: color 160ms ease;
  }

  .article-feed-item:hover .article-feed-title {
    color: var(--accent);
  }

  .article-feed-summary {
    margin: 0;
    color: var(--muted);
    font-size: 0.95rem;
    line-height: 1.5;
    max-width: 48ch;
  }

  .article-feed-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem;
    padding-top: 0.25rem;
  }

  .article-feed-thumb {
    width: 8rem;
    aspect-ratio: 4 / 3;
    object-fit: cover;
    border-radius: var(--radius-sm);
  }

  @media (max-width: 720px) {
    .article-feed-item {
      grid-template-columns: 1fr;
    }

    .article-feed-thumb {
      width: 100%;
      aspect-ratio: 3 / 2;
    }

    .featured-story-image {
      aspect-ratio: 3 / 2;
    }
  }
</style>
