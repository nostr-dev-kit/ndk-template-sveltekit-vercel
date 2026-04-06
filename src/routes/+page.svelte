<script lang="ts">
  import type { PageProps } from './$types';
  import { browser } from '$app/environment';
  import { NDKEvent, type NostrEvent } from '@nostr-dev-kit/ndk';
  import StoryAuthor from '$lib/components/StoryAuthor.svelte';
  import { reveal } from '$lib/actions/reveal';
  import { ndk } from '$lib/ndk/client';
  import {
    articleImageUrl,
    articlePublishedAt,
    articleReadTimeMinutes,
    articleSummary,
    articleTitle,
    articleTopics,
    formatDisplayDate,
    noteExcerpt
  } from '$lib/ndk/format';

  let { data }: PageProps = $props();

  const discussedComments = ndk.$metaSubscribe(() => {
    if (!browser) return undefined;

    return {
      filters: [{ kinds: [1111], '#K': ['30023'], limit: 72 }],
      sort: 'count'
    };
  });

  const recentArticles = ndk.$subscribe(() => {
    if (!browser) return undefined;

    return {
      filters: [{ kinds: [30023], limit: 12 }]
    };
  });

  const seedArticles = $derived((data.articles ?? []).map((event: NostrEvent) => new NDKEvent(ndk, event)));
  const liveArticles = $derived(mergeUniqueArticles(recentArticles.events, seedArticles, 12));
  const articles = $derived(liveArticles.length > 0 ? liveArticles : seedArticles);
  const activeComments = $derived(discussedComments.events.slice(0, 4));
  const articleLookup = $derived.by(() => {
    const lookup = new Map<string, NDKEvent>();

    for (const article of articles) {
      if (article.id) lookup.set(article.id, article);

      const tagId = article.tagId();
      if (tagId) lookup.set(tagId, article);
    }

    return lookup;
  });
  const activeCommentCards = $derived(
    activeComments.map((event) => ({
      event,
      article: resolveCommentTargetArticle(event)
    }))
  );
  const featuredArticle = $derived.by(() =>
    articles.find((event) => Boolean(articleImageUrl(event.rawEvent())))
  );
  const featuredTitle = $derived(featuredArticle ? articleTitle(featuredArticle.rawEvent()) : '');
  const featuredImage = $derived(featuredArticle ? articleImageUrl(featuredArticle.rawEvent()) : undefined);
  const featuredTopics = $derived(
    featuredArticle ? articleTopics(featuredArticle.rawEvent(), 2) : []
  );
  const featuredTitleSize = $derived.by(() => {
    const wordCount = featuredTitle.split(/\s+/).filter(Boolean).length;
    const characterCount = featuredTitle.length;

    if (characterCount > 92 || wordCount > 12) return 'compact';
    if (characterCount > 68 || wordCount > 9) return 'balanced';
    return 'default';
  });
  const nonFeaturedArticles = $derived.by(() => {
    const featuredId = featuredArticle?.tagId();
    if (!featuredId) return articles;

    return articles.filter((event) => event.tagId() !== featuredId);
  });
  const latestArticles = $derived(nonFeaturedArticles.slice(0, 4));
  const archiveArticles = $derived(nonFeaturedArticles.slice(4, 7));

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

  function commentTargetReference(comment: NDKEvent): string {
    return (
      comment.tags.find((tag) => tag[0] === 'a')?.[1]?.trim() ||
      comment.tags.find((tag) => tag[0] === 'e')?.[1]?.trim() ||
      ''
    );
  }

  function resolveCommentTargetArticle(comment: NDKEvent): NDKEvent | undefined {
    const reference = commentTargetReference(comment);
    return reference ? articleLookup.get(reference) : undefined;
  }

</script>

<section class="lead-grid section">
  {#if featuredArticle && featuredImage}
    <a class="panel story-link-card lead-story reveal" href={`/note/${featuredArticle.encode()}`} use:reveal>
      <div class="lead-story-media">
        <img
          class:loaded={featuredImageLoaded}
          class="lead-story-image"
          src={featuredImage}
          alt={featuredTitle}
          loading="eager"
          decoding="async"
          fetchpriority="high"
          onload={() => (featuredImageLoaded = true)}
        />

        <div class="lead-story-copy">
          <div class="lead-story-badges">
            {#each featuredTopics as topic (topic)}
              <span class="lead-story-topic">{topic}</span>
            {/each}
          </div>

          <div class="lead-story-body">
            <h1 class="lead-story-title" data-size={featuredTitleSize}>{featuredTitle}</h1>
            <div class="story-pub-meta lead-story-meta">
              <span>{formatDisplayDate(articlePublishedAt(featuredArticle.rawEvent()))}</span>
              <span>{articleReadTimeMinutes(featuredArticle.content)} min read</span>
            </div>
            <div class="story-byline lead-story-byline">
              <StoryAuthor {ndk} pubkey={featuredArticle.pubkey} avatarClass="article-author-avatar" />
            </div>
            <p class="lead-deck">{articleSummary(featuredArticle.rawEvent(), 360)}</p>
          </div>
        </div>
      </div>
    </a>
  {:else if articles.length > 0}
    <article class="panel lead-story lead-story-empty reveal" use:reveal>
      <span class="eyebrow eyebrow-yellow">Featured slot</span>
      <h1>No featured story yet.</h1>
      <p class="lead-deck">The lead story appears once an article ships with a tagged image.</p>
    </article>
  {:else}
    <article class="panel lead-story lead-story-empty reveal" use:reveal>
      <h1>Waiting for the first story.</h1>
      <p class="lead-deck">New writing will appear here as soon as stories are available.</p>
    </article>
  {/if}
</section>

<section class="section">
  <div class="section-intro reveal" style="--index: 1;" use:reveal>
    <h2 class="home-section-title">Recent comments</h2>
  </div>

  <div class="comment-grid">
    {#if activeCommentCards.length > 0}
      {#each activeCommentCards as item, index (item.event.id)}
        <a
          class="panel story-link-card rail-story rail-story-comment reveal"
          href={`/note/${item.article ? item.article.encode() : item.event.encode()}`}
          style={`--index: ${index};`}
          use:reveal
        >
          <div class="story-pub-meta">
            <span>{formatDisplayDate(articlePublishedAt(item.event.rawEvent()))}</span>
            <span>Comment</span>
          </div>
          {#if item.article}
            <h3>{articleTitle(item.article.rawEvent())}</h3>
          {/if}
          <p class="rail-comment-body">{noteExcerpt(item.event.content, 180)}</p>
          <div class="story-byline compact">
            <StoryAuthor
              {ndk}
              pubkey={item.event.pubkey}
              avatarClass="article-author-avatar article-author-avatar-compact"
              compact
            />
          </div>
        </a>
      {/each}
    {/if}
  </div>
</section>

<section class="section" id="reading-stack">
  <div class="section-intro reveal" use:reveal>
    <h2 class="home-section-title">More to read</h2>
  </div>

  <div class="story-grid">
    {#if latestArticles.length > 0}
      {#each latestArticles as event, index (event.id)}
        <a
          class="panel story-link-card story-card reveal"
          href={`/note/${event.encode()}`}
          style={`--index: ${index};`}
          use:reveal
        >
          <div class="story-pub-meta">
            <span>{formatDisplayDate(articlePublishedAt(event.rawEvent()))}</span>
            <span>{articleReadTimeMinutes(event.content)} min read</span>
          </div>
          <h3 class="story-card-title">{articleTitle(event.rawEvent())}</h3>
          <p class="story-card-summary">{articleSummary(event.rawEvent(), 180)}</p>
          <div class="story-byline compact">
            <StoryAuthor
              {ndk}
              pubkey={event.pubkey}
              avatarClass="article-author-avatar article-author-avatar-compact"
              compact
            />
          </div>
        </a>
      {/each}
    {:else if browser}
      <article class="panel story-empty">
        <h3>No discussed essays yet.</h3>
        <p class="muted" style="margin: 0;">Looking for fresh writing.</p>
      </article>
    {/if}
  </div>
</section>

{#if archiveArticles.length > 0}
  <section class="section reveal" style="--index: 2;" use:reveal>
    <div class="section-intro">
      <h2 class="home-section-title">Additional reading</h2>
    </div>

    <div class="archive-grid">
      {#each archiveArticles as event, index (event.id)}
        <a
          class="archive-card story-link-card reveal"
          href={`/note/${event.encode()}`}
          style={`--index: ${index};`}
          use:reveal
        >
          <div class="story-pub-meta">
            <span>{formatDisplayDate(articlePublishedAt(event.rawEvent()))}</span>
            <span>{articleReadTimeMinutes(event.content)} min read</span>
          </div>
          <h3>{articleTitle(event.rawEvent())}</h3>
          <p>{articleSummary(event.rawEvent(), 150)}</p>
        </a>
      {/each}
    </div>
  </section>
{/if}

<style>
  .lead-story-copy {
    display: grid;
    align-content: end;
    gap: 1rem;
    width: 100%;
  }

  .lead-story-body {
    width: 100%;
    max-width: none;
    gap: 0.8rem;
  }

  .lead-story-title {
    max-width: none;
    font-size: clamp(2.35rem, 4vw, 4.15rem);
    line-height: 0.94;
    letter-spacing: -0.055em;
  }

  .lead-story-title[data-size='balanced'] {
    max-width: none;
    font-size: clamp(2.1rem, 3.45vw, 3.45rem);
    line-height: 0.96;
    letter-spacing: -0.045em;
  }

  .lead-story-title[data-size='compact'] {
    max-width: none;
    font-size: clamp(1.8rem, 2.95vw, 2.85rem);
    line-height: 0.98;
    letter-spacing: -0.035em;
  }

  .lead-story-meta {
    font-size: 0.88rem;
  }

  .lead-story-byline {
    width: 100%;
    align-items: flex-start;
  }

  .lead-deck {
    max-width: none;
  }

  .lead-story-byline :global(.story-author-name) {
    color: #fffaf0;
  }

  .lead-story-byline :global(.story-author-handle) {
    color: rgba(255, 250, 240, 0.72);
  }

  .lead-story-byline :global(.registry-user-avatar.article-author-avatar) {
    border-color: rgba(255, 250, 240, 0.32);
    background: rgba(255, 250, 240, 0.08);
  }

  @media (max-width: 720px) {
    .lead-story-copy {
      gap: 0.8rem;
    }

    .lead-story-body {
      max-width: none;
    }

    .lead-story-title,
    .lead-story-title[data-size='balanced'],
    .lead-story-title[data-size='compact'] {
      max-width: 100%;
      font-size: clamp(1.85rem, 8vw, 2.9rem);
      line-height: 0.98;
      letter-spacing: -0.04em;
    }

    .lead-story-meta {
      font-size: 0.82rem;
    }
  }
</style>
