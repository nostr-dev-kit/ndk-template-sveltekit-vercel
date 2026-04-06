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
  const featuredArticle = $derived.by(() =>
    articles.find((event) => Boolean(articleImageUrl(event.rawEvent())))
  );
  const featuredImage = $derived(featuredArticle ? articleImageUrl(featuredArticle.rawEvent()) : undefined);
  const featuredTopics = $derived(
    featuredArticle ? articleTopics(featuredArticle.rawEvent(), 2) : []
  );
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

  function stableEventKey(event: NDKEvent): string {
    return event.tagId() || event.id || `${event.kind}:${event.pubkey}:${event.created_at ?? 0}`;
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
          alt={articleTitle(featuredArticle.rawEvent())}
          loading="eager"
          decoding="async"
          fetchpriority="high"
          onload={() => (featuredImageLoaded = true)}
        />
        <div class="lead-story-media-glow"></div>

        <div class="lead-story-badges">
          <span class="eyebrow eyebrow-blue">Featured</span>
          {#each featuredTopics as topic (topic)}
            <span class="lead-story-topic">{topic}</span>
          {/each}
        </div>
      </div>

      <div class="lead-story-copy">
        <h1>{articleTitle(featuredArticle.rawEvent())}</h1>
        <p class="lead-deck">{articleSummary(featuredArticle.rawEvent(), 360)}</p>

        <div class="story-byline">
          <StoryAuthor {ndk} pubkey={featuredArticle.pubkey} avatarClass="article-author-avatar" />

          <div class="story-pub-meta">
            <span>{formatDisplayDate(articlePublishedAt(featuredArticle.rawEvent()))}</span>
            <span>{articleReadTimeMinutes(featuredArticle.content)} min read</span>
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

  <aside class="panel story-rail reveal" style="--index: 1;" use:reveal>
    <div class="section-intro">
      <h2>Recent comments</h2>
    </div>

    <div class="story-rail-list">
      {#if activeComments.length > 0}
        {#each activeComments as event, index (stableEventKey(event))}
          <a class="rail-story rail-story-comment" href={`/note/${event.encode()}`} style={`--index: ${index};`}>
            <div class="story-pub-meta">
              <span>{formatDisplayDate(articlePublishedAt(event.rawEvent()))}</span>
              <span>Comment</span>
            </div>
            <p class="rail-comment-body">{noteExcerpt(event.content, 180)}</p>
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
      {:else}
        <p class="muted" style="margin: 0;">No comments yet.</p>
      {/if}
    </div>
  </aside>
</section>

<section class="section" id="reading-stack">
  <div class="section-intro reveal" use:reveal>
    <h2>More to read</h2>
  </div>

  <div class="story-grid">
    {#if latestArticles.length > 0}
      {#each latestArticles as event, index (stableEventKey(event))}
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
      <h2>Additional reading</h2>
    </div>

    <div class="archive-grid">
      {#each archiveArticles as event, index (stableEventKey(event))}
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
