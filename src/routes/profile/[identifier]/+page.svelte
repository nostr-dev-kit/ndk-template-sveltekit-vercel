<script lang="ts">
  import type { PageProps } from './$types';
  import { page } from '$app/state';
  import { browser } from '$app/environment';
  import { createFetchUser } from '@nostr-dev-kit/svelte';
  import { NDKEvent, type NostrEvent } from '@nostr-dev-kit/ndk';
  import { User } from '$lib/ndk/ui/user';
  import { reveal } from '$lib/actions/reveal';
  import {
    articleImageUrl,
    articlePublishedAt,
    articleReadTimeMinutes,
    articleSummary,
    articleTitle,
    articleTopics,
    cleanText,
    displayNip05,
    displayName,
    formatDisplayDate
  } from '$lib/ndk/format';
  import { ndk } from '$lib/ndk/client';
  import { safeUserPubkey } from '$lib/ndk/user';

  let { data }: PageProps = $props();
  const routeIdentifier = $derived(page.params.identifier || data.identifier || '');
  const user = createFetchUser(ndk, () => routeIdentifier || data.npub || data.pubkey || '');
  const profile = $derived(user.profile ?? data.profile);
  const pubkey = $derived(data.pubkey || safeUserPubkey(user));

  const liveArticles = ndk.$subscribe(() => {
    if (!browser || !pubkey) return undefined;

    return {
      filters: [{ kinds: [30023], authors: [pubkey], limit: 12 }]
    };
  });

  const seedArticles = $derived(
    (data.seedArticles ?? []).map((event: NostrEvent) => new NDKEvent(ndk, event))
  );

  const articles = $derived(liveArticles.events.length > 0 ? liveArticles.events : seedArticles);
  const featuredArticle = $derived(articles[0]);
  const moreArticles = $derived(featuredArticle ? articles.slice(1) : []);
  const missing = $derived(!pubkey && data.missing && user.$loaded);
  const name = $derived(pubkey ? displayName(profile, 'Author') : 'Author');
  const bio = $derived.by(() => {
    const candidate = cleanText(profile?.about) || cleanText(profile?.bio);
    if (!candidate || candidate === '~' || candidate === '-' || candidate === '_') {
      return 'Recent writing collected here.';
    }
    return candidate;
  });
  const handle = $derived(cleanText(typeof profile?.name === 'string' ? profile.name : ''));
  const nip05 = $derived(displayNip05(profile));
  const website = $derived(cleanText(typeof profile?.website === 'string' ? profile.website : ''));
  const location = $derived(cleanText(typeof profile?.location === 'string' ? profile.location : ''));
  const storyCountLabel = $derived(`${articles.length} ${articles.length === 1 ? 'story' : 'stories'}`);
  const focusTopics = $derived(
    [...new Set(articles.flatMap((event) => articleTopics(event.rawEvent(), 4)))].slice(0, 8)
  );
  const latestDateLabel = $derived(
    featuredArticle ? formatDisplayDate(articlePublishedAt(featuredArticle.rawEvent())) : ''
  );
  const featuredImageUrl = $derived(
    featuredArticle ? articleImageUrl(featuredArticle.rawEvent()) : undefined
  );
  function websiteLabel(url: string): string {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return url;
    }
  }

  function imageUrlFor(event: NDKEvent): string | undefined {
    return articleImageUrl(event.rawEvent());
  }
</script>

{#if missing}
  <section class="section reveal" use:reveal>
    <article class="panel stack">
      <h1>We could not find that profile</h1>
      <p class="muted" style="margin: 0;">Try a different profile link or come back in a moment.</p>
    </article>
  </section>
{:else}
  <section class="section reveal" use:reveal>
    <article class="panel author-stage">
      <div class="author-banner">
        <User.Root {ndk} pubkey={pubkey} profile={profile}>
          <User.Banner class="author-banner-media" />
        </User.Root>
        <div class="author-banner-wash" aria-hidden="true"></div>
      </div>

      <div class="author-stage-body">
        <div class="author-id-row">
          <User.Root {ndk} pubkey={pubkey} profile={profile}>
            <User.Avatar class="profile-avatar author-avatar" />
          </User.Root>

          <div class="author-id-copy">
            <h1>{name}</h1>
            <p class="author-bio">{bio}</p>

            <div class="author-link-row">
              {#if handle}
                <span class="mono-inline">@{handle}</span>
              {/if}
              {#if nip05}
                <span class="mono-inline">{nip05}</span>
              {/if}
              {#if location}
                <span class="muted">{location}</span>
              {/if}
            </div>
          </div>
        </div>

        <div class="author-stage-side">
          <div class="author-stat-strip">
            <div class="author-stat">
              <span>Stories</span>
              <strong>{storyCountLabel}</strong>
            </div>

            {#if latestDateLabel}
              <div class="author-stat">
                <span>Latest</span>
                <strong>{latestDateLabel}</strong>
              </div>
            {/if}

            {#if focusTopics.length > 0}
              <div class="author-stat">
                <span>Focus</span>
                <strong>{focusTopics[0]}</strong>
              </div>
            {/if}
          </div>

          {#if website}
            <a class="button-secondary" href={website} target="_blank" rel="noopener noreferrer">
              Visit {websiteLabel(website)}
            </a>
          {/if}
        </div>
      </div>

      <nav class="author-nav" aria-label="Profile sections">
        <a href="#stories">Stories</a>
        <a href="#about">About</a>
      </nav>
    </article>
  </section>

  <section class="section bento author-publication">
    <div class="span-8 stack" id="stories">
      {#if featuredArticle}
        <a class="panel story-link-card author-lead-story reveal" href={`/note/${featuredArticle.encode()}`} use:reveal>
          <div class="author-lead-copy">
            <div class="story-pub-meta">
              <span>{formatDisplayDate(articlePublishedAt(featuredArticle.rawEvent()))}</span>
              <span>{articleReadTimeMinutes(featuredArticle.content)} min read</span>
            </div>

            <h2>{articleTitle(featuredArticle.rawEvent())}</h2>
            <p class="lead-deck">{articleSummary(featuredArticle.rawEvent(), 360)}</p>
          </div>

          {#if featuredImageUrl}
            <img
              class="author-story-thumb author-story-thumb-large"
              src={featuredImageUrl}
              alt=""
              loading="lazy"
            />
          {/if}
        </a>
      {/if}

      <div class="panel author-feed reveal" style="--index: 1;" use:reveal>
        {#if moreArticles.length > 0}
          {#each moreArticles as event, index (event.id)}
            <a
              class="author-feed-row"
              href={`/note/${event.encode()}`}
              style={`--index: ${index};`}
            >
              <div class="author-story-copy">
                <div class="story-pub-meta">
                  <span>{formatDisplayDate(articlePublishedAt(event.rawEvent()))}</span>
                  <span>{articleReadTimeMinutes(event.content)} min read</span>
                </div>
                <h3>{articleTitle(event.rawEvent())}</h3>
                <p>{articleSummary(event.rawEvent(), 220)}</p>
              </div>

              {#if imageUrlFor(event)}
                <img class="author-story-thumb" src={imageUrlFor(event)} alt="" loading="lazy" />
              {/if}
            </a>
          {/each}
        {:else if featuredArticle}
          <p class="muted" style="margin: 0;">No additional stories are loaded for this author yet.</p>
        {:else}
          <p class="muted" style="margin: 0;">No long-form articles loaded for this author yet.</p>
        {/if}
      </div>
    </div>

    <aside class="span-4 author-sidebar reveal" style="--index: 2;" use:reveal id="about">
      <article class="panel author-sidebar-card">
        <div class="section-intro">
          <h3>{name}</h3>
        </div>

        <p class="muted author-side-note">{bio}</p>

        <div class="author-side-links">
          {#if website}
            <a class="button-secondary" href={website} target="_blank" rel="noopener noreferrer">
              {websiteLabel(website)}
            </a>
          {/if}
          {#if nip05}
            <span class="mono-inline">{nip05}</span>
          {/if}
          {#if location}
            <span class="muted">{location}</span>
          {/if}
        </div>
      </article>

      {#if focusTopics.length > 0}
        <article class="panel author-sidebar-card">
          <div class="section-intro">
            <h3>Often writing about</h3>
          </div>
          <p class="muted" style="margin: 0;">{focusTopics.join(' · ')}</p>
        </article>
      {/if}

      <article class="panel author-sidebar-card">
        <div class="section-intro">
          <h3>Catalog</h3>
        </div>

        <div class="definition-list">
          <div class="definition-row">
            <span>Stories</span>
            <p>{storyCountLabel}</p>
          </div>
          {#if latestDateLabel}
            <div class="definition-row">
              <span>Latest</span>
              <p>{latestDateLabel}</p>
            </div>
          {/if}
          {#if focusTopics.length > 0}
            <div class="definition-row">
              <span>Topics</span>
              <p>{focusTopics.slice(0, 3).join(' · ')}</p>
            </div>
          {/if}
        </div>
      </article>

      {#if featuredArticle}
        <article class="panel author-sidebar-card">
          <div class="section-intro">
            <h3>Start here</h3>
          </div>

          <a class="author-sidebar-story" href={`/note/${featuredArticle.encode()}`}>
            <strong>{articleTitle(featuredArticle.rawEvent())}</strong>
            <span class="story-pub-meta">
              <span>{formatDisplayDate(articlePublishedAt(featuredArticle.rawEvent()))}</span>
              <span>{articleReadTimeMinutes(featuredArticle.content)} min read</span>
            </span>
          </a>
        </article>
      {/if}
    </aside>
  </section>
{/if}
