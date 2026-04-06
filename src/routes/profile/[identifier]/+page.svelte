<script lang="ts">
  import type { PageProps } from './$types';
  import { page } from '$app/state';
  import { browser } from '$app/environment';
  import { createFetchUser } from '@nostr-dev-kit/svelte';
  import { NDKEvent, type NostrEvent } from '@nostr-dev-kit/ndk';
  import { User } from '$lib/ndk/ui/user';
  import {
    articlePublishedAt,
    cleanText,
    displayNip05,
    displayName,
    formatDisplayDate
  } from '$lib/ndk/format';
  import ArticleCard from '$lib/components/ArticleCard.svelte';
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
  const missing = $derived(!pubkey && data.missing && user.$loaded);
  const name = $derived(pubkey ? displayName(profile, 'Author') : 'Author');
  const bio = $derived.by(() => {
    const candidate = cleanText(profile?.about) || cleanText(profile?.bio);
    if (!candidate || candidate === '~' || candidate === '-' || candidate === '_') {
      return 'Recent writing collected here.';
    }
    return candidate;
  });
  const nip05 = $derived(displayNip05(profile));
  const website = $derived(cleanText(typeof profile?.website === 'string' ? profile.website : ''));
  const storyCountLabel = $derived(`${articles.length} ${articles.length === 1 ? 'story' : 'stories'}`);
  const latestDateLabel = $derived(
    articles[0] ? formatDisplayDate(articlePublishedAt(articles[0].rawEvent())) : ''
  );

  function websiteLabel(url: string): string {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return url;
    }
  }
</script>

{#if missing}
  <section class="profile-container">
    <h1>We could not find that profile</h1>
    <p class="muted" style="margin: 0;">Try a different profile link or come back in a moment.</p>
  </section>
{:else}
  <section class="profile-container">
    <div class="profile-header">
      <User.Root {ndk} pubkey={pubkey} profile={profile}>
        <User.Avatar class="profile-avatar author-avatar-centered" />
      </User.Root>

      <h1>{name}</h1>
      <p class="profile-bio">{bio}</p>

      <div class="profile-meta-row">
        {#if nip05}
          <span class="muted">{nip05}</span>
        {/if}
        <span class="muted">{storyCountLabel}</span>
        {#if latestDateLabel}
          <span class="muted">Latest: {latestDateLabel}</span>
        {/if}
        {#if website}
          <a class="profile-website-link" href={website} target="_blank" rel="noopener noreferrer">
            {websiteLabel(website)}
          </a>
        {/if}
      </div>
    </div>
  </section>

  {#if articles.length > 0}
    <section class="article-feed profile-feed">
      {#each articles as event (event.id)}
        <ArticleCard {event} />
      {/each}
    </section>
  {:else}
    <section class="profile-container">
      <p class="muted" style="margin: 0;">No long-form articles loaded for this author yet.</p>
    </section>
  {/if}
{/if}

<style>
  .profile-container {
    max-width: var(--content-width);
    margin: 0 auto;
  }

  .profile-header {
    display: grid;
    justify-items: center;
    gap: 0.75rem;
    text-align: center;
    padding-bottom: 1.5rem;
  }

  :global(.author-avatar-centered) {
    width: 5rem;
    height: 5rem;
    border: 1px solid var(--border);
  }

  .profile-bio {
    margin: 0;
    color: var(--text);
    font-size: 1.02rem;
    max-width: 48ch;
  }

  .profile-meta-row {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.75rem;
    font-size: 0.85rem;
  }

  .profile-website-link {
    color: var(--accent);
  }

  .profile-website-link:hover {
    color: var(--accent-hover);
  }

  .profile-feed {
    max-width: var(--content-width);
    margin: 0 auto;
  }

  .article-feed {
    display: grid;
  }
</style>
