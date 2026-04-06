<script lang="ts">
  import type { PageProps } from './$types';
  import { browser } from '$app/environment';
  import { NDKEvent, type NostrEvent } from '@nostr-dev-kit/ndk';
  import StoryAuthor from '$lib/components/StoryAuthor.svelte';
  import { reveal } from '$lib/actions/reveal';
  import { ndk } from '$lib/ndk/client';
  import {
    articlePublishedAt,
    articleReadTimeMinutes,
    articleSummary,
    articleTitle,
    formatDisplayDate
  } from '$lib/ndk/format';

  let { data }: PageProps = $props();

  const discussedArticles = ndk.$metaSubscribe(() => {
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
  const liveArticles = $derived(mergeUniqueArticles(discussedArticles.events, recentArticles.events, 12));
  const articles = $derived(liveArticles.length > 0 ? liveArticles : seedArticles);
  const featuredArticle = $derived(articles[0]);
  const railArticles = $derived(featuredArticle ? articles.slice(1, 5) : articles.slice(0, 4));
  const latestArticles = $derived(featuredArticle ? articles.slice(5, 9) : articles.slice(4, 8));
  const archiveArticles = $derived(featuredArticle ? articles.slice(9, 12) : articles.slice(8, 11));

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

<section class="lead-grid section">
  {#if featuredArticle}
    <a class="panel story-link-card lead-story reveal" href={`/note/${featuredArticle.encode()}`} use:reveal>
      <h1>{articleTitle(featuredArticle.rawEvent())}</h1>
      <p class="lead-deck">{articleSummary(featuredArticle.rawEvent(), 360)}</p>

      <div class="story-byline">
        <StoryAuthor {ndk} pubkey={featuredArticle.pubkey} avatarClass="article-author-avatar" />

        <div class="story-pub-meta">
          <span>{formatDisplayDate(articlePublishedAt(featuredArticle.rawEvent()))}</span>
          <span>{articleReadTimeMinutes(featuredArticle.content)} min read</span>
        </div>
      </div>
    </a>
  {:else}
    <article class="panel lead-story reveal" use:reveal>
      <h1>Waiting for the first story.</h1>
      <p class="lead-deck">New writing will appear here as soon as stories are available.</p>
    </article>
  {/if}

  <aside class="panel story-rail reveal" style="--index: 1;" use:reveal>
    <div class="section-intro">
      <h2>Active essays</h2>
    </div>

    <div class="story-rail-list">
      {#if railArticles.length > 0}
        {#each railArticles as event, index}
          <a class="rail-story" href={`/note/${event.encode()}`} style={`--index: ${index};`}>
            <div class="story-pub-meta">
              <span>{formatDisplayDate(articlePublishedAt(event.rawEvent()))}</span>
              <span>{articleReadTimeMinutes(event.content)} min read</span>
            </div>
            <h3>{articleTitle(event.rawEvent())}</h3>
            <p>{articleSummary(event.rawEvent(), 120)}</p>
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
        <p class="muted" style="margin: 0;">No discussed essays yet.</p>
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
      {#each latestArticles as event, index}
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
      {#each archiveArticles as event, index}
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
