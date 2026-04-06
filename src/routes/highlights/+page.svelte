<script lang="ts">
  import type { PageProps } from './$types';
  import { browser } from '$app/environment';
  import { NDKEvent, type NostrEvent } from '@nostr-dev-kit/ndk';
  import StoryAuthor from '$lib/components/StoryAuthor.svelte';
  import { ndk } from '$lib/ndk/client';
  import { articleTitle, articleSummary, noteExcerpt } from '$lib/ndk/format';
  import { mergeUniqueEvents } from '$lib/ndk/events';

  let { data }: PageProps = $props();

  const liveHighlights = ndk.$subscribe(() => {
    if (!browser) return undefined;
    return { filters: [{ kinds: [9802], limit: 100 }] };
  });

  const seedHighlights = $derived(
    (data.highlights ?? []).map((e: NostrEvent) => new NDKEvent(ndk, e))
  );
  const seedArticles = $derived(
    (data.articles ?? []).map((e: NostrEvent) => new NDKEvent(ndk, e))
  );

  const highlights = $derived(
    mergeUniqueEvents(liveHighlights.events, seedHighlights, 200)
      .toSorted((a, b) => (b.created_at ?? 0) - (a.created_at ?? 0))
  );

  const articleLookup = $derived.by(() => {
    const lookup = new Map<string, NDKEvent>();
    for (const article of seedArticles) {
      if (article.id) lookup.set(article.id, article);
      const tagId = article.tagId();
      if (tagId) lookup.set(tagId, article);
    }
    return lookup;
  });

  function highlightArticleRef(highlight: NDKEvent): string {
    return (
      highlight.tags.find((t) => t[0] === 'a')?.[1]?.trim() ||
      highlight.tags.find((t) => t[0] === 'e')?.[1]?.trim() ||
      ''
    );
  }

  type ArticleEntry = {
    article: NDKEvent;
    ref: string;
    highlights: NDKEvent[];
    uniqueHighlighters: number;
    bestQuote: string;
    latestHighlightTime: number;
  };

  const articleEntries = $derived.by(() => {
    // Group highlights by article reference
    const byArticle = new Map<string, NDKEvent[]>();
    for (const h of highlights) {
      const ref = highlightArticleRef(h);
      if (!ref) continue;
      const list = byArticle.get(ref) ?? [];
      list.push(h);
      byArticle.set(ref, list);
    }

    // Build article entries
    const entries: ArticleEntry[] = [];
    for (const [ref, articleHighlights] of byArticle) {
      const article = articleLookup.get(ref);
      if (!article) continue;

      const highlighters = new Set(articleHighlights.map((h) => h.pubkey));

      // Find the most-repeated content (popular passage)
      const contentCounts = new Map<string, number>();
      for (const h of articleHighlights) {
        const content = h.content.trim();
        if (!content) continue;
        contentCounts.set(content, (contentCounts.get(content) ?? 0) + 1);
      }

      let bestQuote = '';
      let bestCount = 0;
      for (const [content, count] of contentCounts) {
        if (count > bestCount || (count === bestCount && content.length > bestQuote.length)) {
          bestQuote = content;
          bestCount = count;
        }
      }

      if (!bestQuote && articleHighlights.length > 0) {
        bestQuote = articleHighlights[0].content.trim();
      }

      entries.push({
        article,
        ref,
        highlights: articleHighlights,
        uniqueHighlighters: highlighters.size,
        bestQuote,
        latestHighlightTime: Math.max(...articleHighlights.map((h) => h.created_at ?? 0))
      });
    }

    // Sort by number of unique highlighters desc, then by recency
    return entries.sort((a, b) => {
      if (b.uniqueHighlighters !== a.uniqueHighlighters) {
        return b.uniqueHighlighters - a.uniqueHighlighters;
      }
      return b.latestHighlightTime - a.latestHighlightTime;
    });
  });

  const heroEntry = $derived(articleEntries[0] ?? null);
  const gridEntries = $derived(articleEntries.slice(1));
  const sidebarEntries = $derived(articleEntries.slice(0, 8));

  function sampleQuotes(entry: ArticleEntry, max: number): string[] {
    const seen = new Set<string>();
    const quotes: string[] = [];
    for (const h of entry.highlights) {
      const content = h.content.trim();
      if (!content || seen.has(content)) continue;
      seen.add(content);
      quotes.push(content);
      if (quotes.length >= max) break;
    }
    return quotes;
  }
</script>

<div class="hl-page">
  {#if heroEntry}
    <section class="hl-hero">
      <a class="hl-hero-card" href={`/note/${heroEntry.article.encode()}`}>
        <blockquote class="hl-hero-quote">
          {noteExcerpt(heroEntry.bestQuote, 500)}
        </blockquote>
        <div class="hl-hero-info">
          <span class="hl-hero-title">{articleTitle(heroEntry.article.rawEvent())}</span>
          <div class="hl-hero-byline">
            <StoryAuthor
              {ndk}
              pubkey={heroEntry.article.pubkey}
              avatarClass="article-author-avatar article-author-avatar-compact"
              compact
            />
            <span class="hl-badge">
              {heroEntry.highlights.length} highlight{heroEntry.highlights.length === 1 ? '' : 's'}
              · {heroEntry.uniqueHighlighters} reader{heroEntry.uniqueHighlighters === 1 ? '' : 's'}
            </span>
          </div>
        </div>
      </a>
    </section>
  {/if}

  <div class="hl-body">
    <div class="hl-main">
      {#if gridEntries.length === 0 && !heroEntry}
        <p class="muted">No highlights yet.</p>
      {:else}
        <div class="hl-grid">
          {#each gridEntries as entry, i (entry.ref)}
            {@const isWide = i % 3 === 0}
            {@const quotes = sampleQuotes(entry, isWide ? 3 : 2)}
            <a
              class="hl-card"
              class:hl-card-wide={isWide}
              href={`/note/${entry.article.encode()}`}
            >
              <div class="hl-card-header">
                <span class="hl-card-title">{articleTitle(entry.article.rawEvent())}</span>
                <p class="hl-card-summary">{articleSummary(entry.article.rawEvent(), 120)}</p>
                <div class="hl-card-byline">
                  <StoryAuthor
                    {ndk}
                    pubkey={entry.article.pubkey}
                    avatarClass="article-author-avatar article-author-avatar-compact"
                    compact
                  />
                </div>
              </div>

              <div class="hl-card-quotes">
                {#each quotes as quote}
                  <blockquote class="hl-card-quote">
                    {noteExcerpt(quote, isWide ? 280 : 160)}
                  </blockquote>
                {/each}
              </div>

              <div class="hl-card-footer">
                <span class="hl-badge">
                  {entry.highlights.length} highlight{entry.highlights.length === 1 ? '' : 's'}
                </span>
                <span class="hl-readers">
                  {entry.uniqueHighlighters} reader{entry.uniqueHighlighters === 1 ? '' : 's'}
                </span>
              </div>
            </a>
          {/each}
        </div>
      {/if}
    </div>

    {#if sidebarEntries.length > 0}
      <aside class="hl-sidebar">
        <span class="hl-sidebar-heading">Most highlighted</span>
        <div class="hl-sidebar-list">
          {#each sidebarEntries as entry (entry.ref)}
            <a class="hl-sidebar-item" href={`/note/${entry.article.encode()}`}>
              <span class="hl-sidebar-title">{articleTitle(entry.article.rawEvent())}</span>
              <div class="hl-sidebar-meta">
                <StoryAuthor
                  {ndk}
                  pubkey={entry.article.pubkey}
                  avatarClass="article-author-avatar article-author-avatar-compact"
                  compact
                />
                <span class="hl-badge">{entry.highlights.length}</span>
              </div>
            </a>
          {/each}
        </div>
      </aside>
    {/if}
  </div>
</div>

<style>
  .hl-page {
    display: grid;
    gap: 2.5rem;
  }

  .hl-body {
    display: grid;
    grid-template-columns: 1fr 20rem;
    gap: 3rem;
    align-items: start;
  }

  .hl-main {
    min-width: 0;
  }

  /* ── hero ───────────────────────────────────────────────────── */

  .hl-hero-card {
    display: grid;
    gap: 1.25rem;
    padding: 2.25rem 2.5rem;
    background: var(--pale-blue);
    border-left: 4px solid rgba(31, 108, 159, 0.45);
    border-radius: 0 var(--radius-md) var(--radius-md) 0;
    color: inherit;
    text-decoration: none;
    transition: border-left-color 200ms ease;
  }

  .hl-hero-card:hover {
    border-left-color: var(--accent);
  }

  .hl-hero-quote {
    margin: 0;
    font-family: var(--font-serif);
    font-size: clamp(1.3rem, 2.2vw, 1.85rem);
    font-weight: 400;
    line-height: 1.5;
    color: var(--text-strong);
  }

  .hl-hero-info {
    display: grid;
    gap: 0.65rem;
  }

  .hl-hero-title {
    font-size: 1.05rem;
    font-weight: 600;
    color: var(--accent);
    transition: color 160ms ease;
  }

  .hl-hero-card:hover .hl-hero-title {
    color: var(--accent-hover);
  }

  .hl-hero-byline {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem;
  }

  /* ── badge ──────────────────────────────────────────────────── */

  .hl-badge {
    display: inline-flex;
    align-items: center;
    padding: 0.2rem 0.55rem;
    border-radius: 9999px;
    background: rgba(31, 108, 159, 0.1);
    color: var(--pale-blue-text);
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.03em;
    white-space: nowrap;
  }

  .hl-readers {
    font-size: 0.78rem;
    color: var(--muted);
  }

  /* ── grid ───────────────────────────────────────────────────── */

  .hl-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.25rem;
  }

  .hl-card {
    display: grid;
    gap: 1rem;
    padding: 1.25rem;
    border: 1px solid var(--border-light);
    border-radius: var(--radius-md);
    color: inherit;
    text-decoration: none;
    transition: border-color 200ms ease, box-shadow 200ms ease;
  }

  .hl-card:hover {
    border-color: var(--border);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
  }

  .hl-card-wide {
    grid-column: 1 / -1;
  }

  .hl-card-header {
    display: grid;
    gap: 0.4rem;
  }

  .hl-card-title {
    font-family: var(--font-serif);
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--text-strong);
    line-height: 1.25;
    letter-spacing: -0.01em;
    transition: color 160ms ease;
  }

  .hl-card:hover .hl-card-title {
    color: var(--accent);
  }

  .hl-card-summary {
    margin: 0;
    color: var(--muted);
    font-size: 0.85rem;
    line-height: 1.5;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .hl-card-byline {
    padding-top: 0.25rem;
  }

  .hl-card-quotes {
    display: grid;
    gap: 0.6rem;
  }

  .hl-card-quote {
    margin: 0;
    padding: 0.65rem 0.85rem;
    border-left: 3px solid rgba(31, 108, 159, 0.3);
    border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
    background: var(--pale-blue);
    color: var(--text-strong);
    font-family: var(--font-serif);
    font-size: 0.88rem;
    line-height: 1.55;
  }

  .hl-card-footer {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }

  /* ── sidebar ────────────────────────────────────────────────── */

  .hl-sidebar {
    position: sticky;
    top: 5rem;
    display: grid;
    gap: 1rem;
  }

  .hl-sidebar-heading {
    font-family: var(--font-sans);
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted);
  }

  .hl-sidebar-list {
    display: grid;
  }

  .hl-sidebar-item {
    display: grid;
    gap: 0.45rem;
    padding: 0.85rem 0;
    border-bottom: 1px solid var(--border-light);
    color: inherit;
    text-decoration: none;
  }

  .hl-sidebar-item:first-child {
    padding-top: 0;
  }

  .hl-sidebar-item:last-child {
    border-bottom: none;
  }

  .hl-sidebar-title {
    font-size: 0.88rem;
    font-weight: 600;
    color: var(--text-strong);
    line-height: 1.35;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    transition: color 160ms ease;
  }

  .hl-sidebar-item:hover .hl-sidebar-title {
    color: var(--accent);
  }

  .hl-sidebar-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
  }

  /* ── responsive ─────────────────────────────────────────────── */

  @media (max-width: 900px) {
    .hl-body {
      grid-template-columns: 1fr;
    }

    .hl-sidebar {
      position: static;
    }
  }

  @media (max-width: 720px) {
    .hl-grid {
      grid-template-columns: 1fr;
    }

    .hl-card-wide {
      grid-column: auto;
    }

    .hl-hero-card {
      padding: 1.5rem;
    }

    .hl-hero-quote {
      font-size: 1.2rem;
    }
  }
</style>
