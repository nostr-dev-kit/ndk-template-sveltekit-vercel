<script lang="ts">
  import type { PageProps } from './$types';
  import { browser } from '$app/environment';
  import { NDKEvent, type NostrEvent } from '@nostr-dev-kit/ndk';
  import { User } from '$lib/ndk/ui/user';
  import { reveal } from '$lib/actions/reveal';
  import { DEFAULT_RELAYS } from '$lib/ndk/config';
  import { ndk } from '$lib/ndk/client';
  import {
    articlePublishedAt,
    articleReadTimeMinutes,
    articleSummary,
    articleTitle,
    articleTopics,
    formatDisplayDate,
    shortPubkey
  } from '$lib/ndk/format';

  let { data }: PageProps = $props();

  const liveArticles = ndk.$subscribe(() => {
    if (!browser) return undefined;

    return {
      filters: [{ kinds: [30023], limit: 9 }]
    };
  });

  const currentUser = $derived(ndk.$currentUser);
  const seedArticles = $derived((data.articles ?? []).map((event: NostrEvent) => new NDKEvent(ndk, event)));
  const articles = $derived(liveArticles.events.length > 0 ? liveArticles.events : seedArticles);
  const featuredArticle = $derived(articles[0]);
  const leadArticles = $derived(featuredArticle ? articles.slice(1, 5) : articles.slice(0, 4));
  const archiveArticles = $derived(featuredArticle ? articles.slice(5, 9) : articles.slice(4, 8));
  const railArticles = $derived(leadArticles.slice(0, 3));
  const articleCount = $derived(articles.length);
  const sourceLabel = $derived(
    liveArticles.events.length > 0
      ? 'live relay stream'
      : seedArticles.length > 0
        ? 'server seeded'
        : 'waiting for relays'
  );
  const topicShelf = $derived(
    (() => {
      const topics = new Map<string, string>();

      for (const event of articles as NDKEvent[]) {
        for (const topic of articleTopics(event.rawEvent(), 3)) {
          const key = topic.toLowerCase();
          if (!topics.has(key)) topics.set(key, topic);
        }
      }

      return Array.from(topics.values()).slice(0, 8);
    })()
  );
</script>

<section class="hero-grid section">
  <div class="hero-copy reveal" use:reveal>
    <span class="eyebrow eyebrow-blue">Long-form on Nostr</span>
    <h1>A real front page for Nostr writing.</h1>
    <p class="lede">
      Relay Press is a reading-first Nostr app. The homepage can be seeded on the server, article
      and profile routes stay shareable, and <span class="mono-inline">ndk-svelte</span> keeps the
      session live once the client takes over.
    </p>

    <div class="hero-facts">
      <div class="hero-fact">
        <span>Edition</span>
        <strong>{articleCount > 0 ? `${articleCount} articles in view` : 'Waiting for essays'}</strong>
      </div>
      <div class="hero-fact">
        <span>Source</span>
        <strong>{sourceLabel}</strong>
      </div>
      <div class="hero-fact">
        <span>Relays</span>
        <strong>{DEFAULT_RELAYS.length} defaults configured</strong>
      </div>
    </div>

    <div class="actions">
      <a class="button" href={featuredArticle ? `/note/${featuredArticle.encode()}` : '/about'}>
        Read the lead story
      </a>
      <a class="button-secondary" href="#reading-stack">
        Browse the front page
      </a>
    </div>

    <p class="caption">
      Routes keep SSR and Open Graph metadata intact, so shared links behave like documents instead
      of blank client shells.
    </p>
  </div>

  <div class="hero-rail">
    <article class="panel hero-spotlight reveal" style="--index: 1;" use:reveal>
      <div class="hero-spotlight-head">
        <span class="eyebrow eyebrow-green">Now reading</span>
        <kbd>{sourceLabel}</kbd>
      </div>

      {#if featuredArticle}
        <div class="article-byline">
          <User.Root {ndk} pubkey={featuredArticle.pubkey}>
            <a class="article-author-link" href={`/profile/${featuredArticle.pubkey}`}>
              <User.Avatar class="article-author-avatar article-author-avatar-sm" />
            </a>
            <div class="article-author-copy">
              <div class="feed-meta">
                <a class="article-author-name" href={`/profile/${featuredArticle.pubkey}`}>
                  <User.Name />
                </a>
                <span>{formatDisplayDate(articlePublishedAt(featuredArticle.rawEvent()))}</span>
                <span>{articleReadTimeMinutes(featuredArticle.content)} min read</span>
              </div>
              <div class="feed-meta">
                <User.Handle class="article-author-handle" showAt={false} />
                <span class="mono-inline">{shortPubkey(featuredArticle.pubkey)}</span>
              </div>
            </div>
          </User.Root>
        </div>

        <h2 class="spotlight-title">{articleTitle(featuredArticle.rawEvent())}</h2>
        <p class="spotlight-summary">{articleSummary(featuredArticle.rawEvent(), 240)}</p>

        <div class="topic-row">
          {#each articleTopics(featuredArticle.rawEvent(), 4) as topic}
            <span class="status-pill status-blue">{topic}</span>
          {/each}
        </div>

        <div class="actions">
          <a class="button" href={`/note/${featuredArticle.encode()}`}>Open article</a>
          <a class="button-secondary" href={`/profile/${featuredArticle.pubkey}`}>Author page</a>
        </div>
      {:else}
        <h2 class="spotlight-title">The front page fills itself as soon as the relays answer.</h2>
        <p class="spotlight-summary">
          Point <kbd>PUBLIC_NOSTR_RELAYS</kbd> at your preferred long-form sources and the first
          issue appears without needing client-only placeholders.
        </p>
      {/if}
    </article>

    <aside class="panel soft hero-brief reveal" style="--index: 2;" use:reveal>
      <div class="panel-header">
        <span class="eyebrow eyebrow-yellow">On the wire</span>
        <h3>Recent arrivals</h3>
      </div>

      <div class="brief-list">
        {#if railArticles.length > 0}
          {#each railArticles as event, index}
            <article class="brief-item" style={`--index: ${index};`}>
              <div class="feed-meta">
                <span>{formatDisplayDate(articlePublishedAt(event.rawEvent()))}</span>
                <span>{articleReadTimeMinutes(event.content)} min read</span>
              </div>
              <a class="brief-link" href={`/note/${event.encode()}`}>{articleTitle(event.rawEvent())}</a>
              <div class="feed-meta">
                <a href={`/profile/${event.pubkey}`}>{shortPubkey(event.pubkey)}</a>
              </div>
            </article>
          {/each}
        {:else}
          <p class="muted" style="margin: 0;">
            No fresh articles yet. The rail fills from the same <kbd>30023</kbd> relay stream as
            the featured story.
          </p>
        {/if}
      </div>
    </aside>
  </div>
</section>

<section class="section bento">
  <article class="panel span-7 reveal" use:reveal>
    <div class="panel-header">
      <span class="eyebrow eyebrow-red">Reading room</span>
      <h2>The front page should open with writing, not framework talk.</h2>
      <p class="muted" style="margin: 0;">
        Server rendering gives the app a real first screen. Hydration can continue the session after
        load without changing the document feel.
      </p>
    </div>

    {#if featuredArticle}
      <div class="reading-room">
        <div class="reading-room-copy">
          <p class="room-kicker">Lead essay</p>
          <h3 class="room-title">{articleTitle(featuredArticle.rawEvent())}</h3>
          <p class="feature-copy">{articleSummary(featuredArticle.rawEvent(), 520)}</p>
        </div>

        <div class="reading-room-side">
          <div class="definition-list">
            <div class="definition-row">
              <span>Published</span>
              <p>{formatDisplayDate(articlePublishedAt(featuredArticle.rawEvent()))}</p>
            </div>
            <div class="definition-row">
              <span>Read time</span>
              <p>{articleReadTimeMinutes(featuredArticle.content)} minutes</p>
            </div>
            <div class="definition-row">
              <span>Author</span>
              <p>{shortPubkey(featuredArticle.pubkey)}</p>
            </div>
            <div class="definition-row">
              <span>Route</span>
              <p>Shareable article and profile URLs work before the browser subscribes.</p>
            </div>
          </div>

          <div class="actions">
            <a class="button" href={`/note/${featuredArticle.encode()}`}>Read article</a>
            <a class="button-secondary" href="/about">About the template</a>
          </div>
        </div>
      </div>
    {:else}
      <p class="muted" style="margin: 0;">
        The reading room opens once the first long-form event arrives from the configured relay set.
      </p>
    {/if}
  </article>

  <article class="panel span-5 reveal" style="--index: 1;" use:reveal>
    <span class="eyebrow eyebrow-green">Edition</span>
    <h3>Publication routes, real authors, deploy-ready defaults.</h3>
    <div class="topic-cloud">
      {#if topicShelf.length > 0}
        {#each topicShelf as topic}
          <span class="status-pill status-blue">{topic}</span>
        {/each}
      {:else}
        <p class="muted" style="margin: 0;">
          Topic tags appear here once articles with <kbd>t</kbd> tags arrive.
        </p>
      {/if}
    </div>
    <div class="definition-list">
      <div class="definition-row">
        <span>Feed</span>
        <p>Watching <kbd>30023</kbd> so the homepage feels like a publication instead of a note wall.</p>
      </div>
      <div class="definition-row">
        <span>SSR</span>
        <p>The first screen can be seeded on the server before the browser starts subscribing.</p>
      </div>
      <div class="definition-row">
        <span>Session</span>
        <p>
          {#if currentUser}
            Signed in as <span class="mono-inline">{currentUser.npub.slice(0, 18)}...</span>
          {:else}
            Browser login stays available without leaking session assumptions into SSR.
          {/if}
        </p>
      </div>
      <div class="definition-row">
        <span>Deploy</span>
        <p><span class="mono-inline">@sveltejs/adapter-vercel</span> is already wired for Vercel.</p>
      </div>
    </div>
  </article>
</section>

<section class="section bento" id="reading-stack">
  <article class="panel span-8 reveal" use:reveal>
    <div class="panel-header">
      <span class="eyebrow eyebrow-blue">Reading stack</span>
      <h2>Latest long-form articles from the configured relays</h2>
      <p class="muted" style="margin: 0;">
        The first response can arrive with seeded articles. After hydration, the browser can switch
        to a live relay-backed shelf without losing the publication layout.
      </p>
    </div>

    <div class="window">
      <div class="window-chrome">
        <span class="window-controls" aria-hidden="true">
          <span class="window-dot"></span>
          <span class="window-dot"></span>
          <span class="window-dot"></span>
        </span>
        <span>Long-form library</span>
        <kbd>{sourceLabel}</kbd>
      </div>

      <div class="window-body">
        {#if leadArticles.length > 0}
          {#each leadArticles as event, index}
            <article class="feed-row article-row reveal" style={`--index: ${index};`} use:reveal>
              <div class="article-byline">
                <User.Root {ndk} pubkey={event.pubkey}>
                  <a class="article-author-link" href={`/profile/${event.pubkey}`}>
                    <User.Avatar class="article-author-avatar article-author-avatar-sm" />
                  </a>
                  <div class="article-author-copy">
                    <div class="feed-meta">
                      <a class="article-author-name" href={`/profile/${event.pubkey}`}>
                        <User.Name />
                      </a>
                      <span>{formatDisplayDate(articlePublishedAt(event.rawEvent()))}</span>
                      <span>{articleReadTimeMinutes(event.content)} min read</span>
                    </div>
                    <div class="feed-meta">
                      <User.Handle class="article-author-handle" showAt={false} />
                      <span class="mono-inline">{shortPubkey(event.pubkey)}</span>
                    </div>
                  </div>
                </User.Root>
              </div>
              <h3 class="feed-title">{articleTitle(event.rawEvent())}</h3>
              <p class="feed-text">{articleSummary(event.rawEvent(), 220)}</p>
              <div class="row-actions">
                <div class="topic-row">
                  {#each articleTopics(event.rawEvent(), 3) as topic}
                    <span class="status-pill status-yellow">{topic}</span>
                  {/each}
                </div>
                <a class="button-link" href={`/note/${event.encode()}`}>Open article</a>
              </div>
            </article>
          {/each}
        {:else if browser}
          <div class="feed-row">
            <p class="muted" style="margin: 0;">Waiting for article relays to answer...</p>
          </div>
        {:else}
          <div class="feed-row">
            <p class="muted" style="margin: 0;">This shelf is seeded on the server when relay data is available.</p>
          </div>
        {/if}
      </div>
    </div>
  </article>

  <aside class="panel span-4 reveal" style="--index: 1;" use:reveal>
    <span class="eyebrow eyebrow-green">Desk notes</span>
    <h3>The rest of the template stays production-shaped.</h3>
    <div class="definition-list">
      <div class="definition-row">
        <span>Profile</span>
        <p>Author pages are server-rendered and seeded with recent writing.</p>
      </div>
      <div class="definition-row">
        <span>Article</span>
        <p>Article routes can carry canonical, Open Graph, and Twitter metadata.</p>
      </div>
      <div class="definition-row">
        <span>Deploy</span>
        <p><span class="mono-inline">@sveltejs/adapter-vercel</span> is already wired for Vercel.</p>
      </div>
      <div class="definition-row">
        <span>jsrepo</span>
        <p>Additional primitives can land in the same structure with <kbd>bunx jsrepo add ...</kbd>.</p>
      </div>
    </div>
  </aside>
</section>

<section class="section reveal" style="--index: 2;" use:reveal>
  <div class="panel stack">
    <div class="panel-header">
      <span class="eyebrow eyebrow-red">Archive</span>
      <h2>Older pieces still on the wire</h2>
      <p class="muted" style="margin: 0;">
        The app keeps a quieter archive shelf under the lead story so long-form writing feels
        curated instead of infinite.
      </p>
    </div>

    <div class="archive-grid">
      {#if archiveArticles.length > 0}
        {#each archiveArticles as event, index}
          <article class="archive-card reveal" style={`--index: ${index};`} use:reveal>
            <div class="feed-meta">
              <a href={`/profile/${event.pubkey}`}>{shortPubkey(event.pubkey)}</a>
              <span>{formatDisplayDate(articlePublishedAt(event.rawEvent()))}</span>
            </div>
            <h3>{articleTitle(event.rawEvent())}</h3>
            <p>{articleSummary(event.rawEvent(), 150)}</p>
            <a class="button-link" href={`/note/${event.encode()}`}>Read article</a>
          </article>
        {/each}
      {:else}
        <article class="archive-card">
          <h3>Archive will populate from the relay set.</h3>
          <p>
            Use the default relay list or swap in your own publication-focused relays. The layout is
            ready either way.
          </p>
          <a class="button-link" href="/about">Review the template details</a>
        </article>
      {/if}
    </div>
  </div>
</section>
