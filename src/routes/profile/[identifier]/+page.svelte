<script lang="ts">
  import type { PageProps } from './$types';
  import { page } from '$app/state';
  import { browser } from '$app/environment';
  import { createFetchUser } from '@nostr-dev-kit/svelte';
  import { NDKKind } from '@nostr-dev-kit/ndk';
  import { User } from '$lib/ndk/ui/user';
  import { cleanText, displayNip05, displayName } from '$lib/ndk/format';
  import { ndk } from '$lib/ndk/client';
  import { safeUserPubkey } from '$lib/ndk/user';

  let { data }: PageProps = $props();
  const routeIdentifier = $derived(page.params.identifier || data.identifier || '');
  const user = createFetchUser(ndk, () => routeIdentifier || data.npub || data.pubkey || '');
  const profile = $derived(user.profile ?? data.profile);
  const pubkey = $derived(data.pubkey || safeUserPubkey(user));
  const isOwnProfile = $derived(Boolean(pubkey && ndk.$currentUser && ndk.$currentUser.pubkey === pubkey));

  // ── NIP-F1 subscription ────────────────────────────────────────
  const nipF1Sub = ndk.$subscribe(() => {
    if (!browser || !pubkey) return undefined;
    return {
      filters: [{ kinds: [19999 as NDKKind], authors: [pubkey], limit: 1 }]
    };
  });

  const nipF1Event = $derived(nipF1Sub.events[0] ?? null);
  const nipF1Tags = $derived(nipF1Event?.tags ?? []);
  const nipF1BgColor = $derived(nipF1Tags.find((t) => t[0] === 'background-color')?.[1] ?? '');
  const nipF1FgColor = $derived(nipF1Tags.find((t) => t[0] === 'foreground-color')?.[1] ?? '');
  const nipF1Music = $derived(nipF1Tags.find((t) => t[0] === 'background-music')?.[1] ?? '');
  const nipF1CustomFields = $derived(
    nipF1Tags
      .filter((t) => t[0] === 'custom' && t[1] && t[2])
      .map((t) => ({ key: t[1], value: t[2] }))
  );

  const missing = $derived(!pubkey && data.missing && user.$loaded);
  const name = $derived(pubkey ? displayName(profile, 'Author') : 'Author');
  const bio = $derived.by(() => {
    const candidate = cleanText(profile?.about) || cleanText(profile?.bio);
    if (!candidate || candidate === '~' || candidate === '-' || candidate === '_') {
      return '';
    }
    return candidate;
  });
  const nip05 = $derived(displayNip05(profile));
  const bannerUrl = $derived(cleanText(profile?.banner));
  const website = $derived(cleanText(typeof profile?.website === 'string' ? profile.website : ''));

  // ── music player state ─────────────────────────────────────────
  let musicPlaying = $state(false);
  let audioEl: HTMLAudioElement | null = $state(null);

  function toggleMusic() {
    if (!audioEl) return;
    if (musicPlaying) {
      audioEl.pause();
      musicPlaying = false;
    } else {
      audioEl.muted = false;
      void audioEl.play();
      musicPlaying = true;
    }
  }

  function websiteLabel(url: string): string {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return url;
    }
  }

  // ── Apply NIP-F1 colors to the whole page ──────────────────────
  $effect(() => {
    if (!browser) return;
    if (nipF1BgColor) {
      document.body.style.setProperty('background-color', nipF1BgColor);
    } else {
      document.body.style.removeProperty('background-color');
    }
    if (nipF1FgColor) {
      document.body.style.setProperty('color', nipF1FgColor);
    } else {
      document.body.style.removeProperty('color');
    }
    return () => {
      document.body.style.removeProperty('background-color');
      document.body.style.removeProperty('color');
    };
  });
</script>

{#if missing}
  <section class="profile-container profile-missing">
    <h1>We could not find that profile</h1>
    <p class="muted" style="margin: 0;">Try a different profile link or come back in a moment.</p>
    <a class="profile-missing-link" href="/projects">← Browse all projects</a>
  </section>
{:else}
  <section class="profile-container">
    {#if bannerUrl}
      <div class="profile-banner">
        <img src={bannerUrl} alt="" class="profile-banner-img" />
      </div>
    {/if}

    <div class="profile-header">
      <User.Root {ndk} pubkey={pubkey} profile={profile}>
        <User.Avatar class="profile-avatar author-avatar-centered" />
      </User.Root>

      <h1>{name}</h1>
      {#if bio}
        <p class="profile-bio">{bio}</p>
      {/if}

      <div class="profile-meta-row">
        {#if nip05}
          <span class="muted">{nip05}</span>
        {/if}
        {#if website}
          <a class="profile-website-link" href={website} target="_blank" rel="noopener noreferrer">
            {websiteLabel(website)}
          </a>
        {/if}
      </div>

      {#if nipF1CustomFields.length > 0}
        <div class="definition-list profile-custom-fields">
          {#each nipF1CustomFields as field (field.key)}
            <div class="definition-row">
              <span>{field.key}</span>
              <p>{field.value}</p>
            </div>
          {/each}
        </div>
      {/if}

      {#if nipF1Music}
        <div class="profile-music">
          <audio bind:this={audioEl} src={nipF1Music} loop muted></audio>
          <button class="profile-music-btn" type="button" onclick={toggleMusic}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              {#if musicPlaying}
                <rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" />
              {:else}
                <polygon points="5 3 19 12 5 21 5 3" />
              {/if}
            </svg>
            {musicPlaying ? 'Pause music' : 'Play music'}
          </button>
        </div>
      {/if}

      <div class="profile-actions">
        {#if pubkey && ndk.$currentUser && ndk.$currentUser.pubkey !== pubkey}
          <button
            class="follow-btn"
            class:following={ndk.$follows.has(pubkey)}
            onclick={() => ndk.$follows.has(pubkey) ? ndk.$follows.remove(pubkey) : ndk.$follows.add(pubkey)}
          >
            {ndk.$follows.has(pubkey) ? 'Following' : 'Follow'}
          </button>
        {/if}
        {#if isOwnProfile}
          <a href="/profile/edit" class="button-secondary profile-edit-btn">Edit profile</a>
        {/if}
      </div>
    </div>
  </section>
{/if}

<style>
  .profile-container {
    max-width: var(--content-width);
    margin: 0 auto;
    border-radius: var(--radius-md);
    padding: 0 0 1rem;
  }

  .profile-missing {
    display: grid;
    gap: 0.75rem;
    padding: 2rem 1rem;
  }

  .profile-missing-link {
    margin-top: 0.5rem;
    color: var(--accent);
    font-weight: 500;
  }

  .profile-missing-link:hover {
    color: var(--accent-hover);
  }

  .profile-banner {
    width: 100%;
    aspect-ratio: 4 / 1;
    overflow: hidden;
    border-radius: var(--radius-md) var(--radius-md) 0 0;
  }

  .profile-banner-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .profile-banner + .profile-header {
    margin-top: -2.5rem;
  }

  .profile-header {
    display: grid;
    justify-items: center;
    gap: 0.75rem;
    text-align: center;
    padding: 0 1rem 1.5rem;
  }

  :global(.author-avatar-centered) {
    width: 5rem;
    height: 5rem;
    border: 3px solid var(--canvas);
    position: relative;
    z-index: 1;
  }

  .profile-bio {
    margin: 0;
    color: inherit;
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

  .profile-custom-fields {
    width: 100%;
    max-width: 24rem;
  }

  .profile-music {
    display: flex;
    justify-content: center;
  }

  .profile-music-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.35rem 0.85rem;
    border: 1px solid var(--border);
    border-radius: 9999px;
    background: var(--surface-soft);
    color: var(--muted);
    font-size: 0.8rem;
    cursor: pointer;
    transition: color 120ms, border-color 120ms;
  }

  .profile-music-btn:hover {
    color: var(--text-strong);
    border-color: var(--text);
  }

  .profile-music-btn svg {
    width: 1rem;
    height: 1rem;
  }

  .profile-actions {
    display: flex;
    gap: 0.75rem;
    align-items: center;
  }

  .profile-edit-btn {
    font-size: 0.88rem;
    text-decoration: none;
  }

  .profile-website-link {
    color: var(--accent);
  }

  .profile-website-link:hover {
    color: var(--accent-hover);
  }

  .follow-btn {
    padding: 0.4rem 1.2rem;
    border-radius: 999px;
    border: 1px solid var(--accent);
    background: var(--accent);
    color: white;
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }

  .follow-btn.following {
    background: transparent;
    color: var(--accent);
  }

  .follow-btn:hover {
    background: var(--accent-hover);
    border-color: var(--accent-hover);
    color: white;
  }
</style>
