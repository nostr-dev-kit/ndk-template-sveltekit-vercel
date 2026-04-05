<script lang="ts">
  import type { PageProps } from './$types';
  import { browser } from '$app/environment';
  import { NDKEvent, type NostrEvent } from '@nostr-dev-kit/ndk';
  import { User } from '$lib/ndk/ui/user';
  import { reveal } from '$lib/actions/reveal';
  import {
    articlePublishedAt,
    articleReadTimeMinutes,
    articleSummary,
    articleTitle,
    articleTopics,
    displayName,
    formatDisplayDate,
    shortPubkey
  } from '$lib/ndk/format';
  import { ndk } from '$lib/ndk/client';

  let { data }: PageProps = $props();

  const liveArticles = ndk.$subscribe(() => {
    if (!browser || !data.pubkey) return undefined;

    return {
      filters: [{ kinds: [30023], authors: [data.pubkey], limit: 8 }]
    };
  });

  const seedArticles = $derived(
    (data.seedArticles ?? []).map((event: NostrEvent) => new NDKEvent(ndk, event))
  );

  const articles = $derived(liveArticles.events.length > 0 ? liveArticles.events : seedArticles);
  const name = $derived(data.pubkey ? displayName(data.profile, shortPubkey(data.pubkey)) : data.identifier);
</script>

{#if data.missing}
  <section class="section reveal" use:reveal>
    <article class="panel stack">
      <span class="eyebrow eyebrow-red">Missing profile</span>
      <h1>We could not resolve `{data.identifier}`</h1>
      <p class="muted" style="margin: 0;">
        Try an <kbd>npub</kbd>, a hex pubkey, or a NIP-05 identifier that is visible on the
        configured relays.
      </p>
    </article>
  </section>
{:else}
  <section class="section bento">
    <article class="panel span-8 reveal" use:reveal>
      <div class="profile-header">
        <User.Root {ndk} pubkey={data.pubkey} profile={data.profile}>
          <User.Avatar class="profile-avatar" />
          <div class="profile-copy">
            <span class="eyebrow eyebrow-blue">Server profile</span>
            <h1><User.Name field="both" /></h1>
            <p class="muted" style="margin: 0; max-width: 42rem;">
              {data.profile?.about || data.profile?.bio || 'The server resolves this profile before the browser connects to relays.'}
            </p>
            <div class="profile-meta-row">
              <User.Handle class="mono-inline" />
              {#if data.profile?.nip05}
                <User.Nip05 class="mono-inline" showVerified={false} />
              {/if}
            </div>
          </div>
        </User.Root>
      </div>

      <div class="definition-list">
        <div class="definition-row">
          <span>npub</span>
          <div class="mono-block">{data.npub}</div>
        </div>
        <div class="definition-row">
          <span>pubkey</span>
          <div class="mono-block">{shortPubkey(data.pubkey ?? data.identifier)}</div>
        </div>
        {#if data.profile?.website}
          <div class="definition-row">
            <span>Website</span>
            <p><a class="button-link" href={data.profile.website} target="_blank" rel="noopener noreferrer">{data.profile.website}</a></p>
          </div>
        {/if}
      </div>
    </article>

    <aside class="panel span-4 reveal" style="--index: 1;" use:reveal>
      <span class="eyebrow eyebrow-yellow">Why SSR</span>
      <h3>This route is shaped for crawlers first.</h3>
      <div class="definition-list">
        <div class="definition-row">
          <span>Fetch</span>
          <p>The server resolves the profile and the first shelf of long-form articles.</p>
        </div>
        <div class="definition-row">
          <span>SEO</span>
          <p>Canonical, Open Graph, and Twitter tags are sent in the first response.</p>
        </div>
        <div class="definition-row">
          <span>Client</span>
          <p>The browser can still replace seeded articles with live subscriptions after hydration.</p>
        </div>
      </div>
    </aside>
  </section>

  <section class="section reveal" use:reveal style="--index: 2;">
    <div class="panel stack">
      <div class="panel-header">
        <span class="eyebrow eyebrow-green">Articles</span>
        <h2>Latest writing by {name}</h2>
      </div>

      <div class="window">
        <div class="window-chrome">
          <span class="window-controls" aria-hidden="true">
            <span class="window-dot"></span>
            <span class="window-dot"></span>
            <span class="window-dot"></span>
          </span>
          <span>Recent long-form articles</span>
          <kbd>{articles.length} items</kbd>
        </div>

        <div class="window-body">
          {#if articles.length > 0}
            {#each articles as event, index}
              <article class="feed-row article-row reveal" style={`--index: ${index};`} use:reveal>
                <div class="feed-meta">
                  <span>{formatDisplayDate(articlePublishedAt(event.rawEvent()))}</span>
                  <span>{articleReadTimeMinutes(event.content)} min read</span>
                  <a href={`/note/${event.encode()}`}>Article route</a>
                </div>
                <h3 class="feed-title">{articleTitle(event.rawEvent())}</h3>
                <p class="feed-text">{articleSummary(event.rawEvent())}</p>
                <div class="topic-row">
                  {#each articleTopics(event.rawEvent(), 3) as topic}
                    <span class="status-pill status-blue">{topic}</span>
                  {/each}
                </div>
              </article>
            {/each}
          {:else}
            <div class="feed-row">
              <p class="muted" style="margin: 0;">No long-form articles loaded for this author yet.</p>
            </div>
          {/if}
        </div>
      </div>
    </div>
  </section>
{/if}
