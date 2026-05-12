<script lang="ts">
  import { createRelayInfo } from '@nostr-dev-kit/svelte';
  import { ndk } from '$lib/ndk/client';

  let {
    relayUrl,
    bookmarked = false,
    userCount,
    onToggleBookmark,
    onRemove,
    showBookmarkToggle = false
  }: {
    relayUrl: string;
    bookmarked?: boolean;
    userCount?: number;
    onToggleBookmark?: () => void;
    onRemove?: () => void;
    showBookmarkToggle?: boolean;
  } = $props();

  const relayInfo = createRelayInfo(() => ({ relayUrl }), ndk);

  function hostnameFromUrl(url: string): string {
    try {
      return new URL(url).hostname;
    } catch {
      return url.replace(/^wss?:\/\//, '');
    }
  }

  const hostname = $derived(hostnameFromUrl(relayUrl));
  const hasNip11 = $derived(!relayInfo.loading && relayInfo.nip11?.name);
</script>

{#if hasNip11}
<div class="relay-card">
  <div class="relay-card-icon">
    {#if relayInfo.nip11?.icon}
      <img src={relayInfo.nip11.icon} alt="" />
    {:else}
      <span>{hostname.charAt(0).toUpperCase()}</span>
    {/if}
  </div>
  <div class="trending-card-body">
    <h3 class="trending-card-title">{relayInfo.nip11?.name || hostname}</h3>
    {#if relayInfo.nip11?.description}
      <p class="trending-card-summary">{relayInfo.nip11.description}</p>
    {/if}
    {#if userCount !== undefined || showBookmarkToggle}
      <div class="trending-card-meta">
        {#if userCount !== undefined}
          <span class="trending-save-count">
            {userCount} {userCount === 1 ? 'reader' : 'readers'}
          </span>
        {/if}
        {#if showBookmarkToggle && onToggleBookmark}
          <button
            class="relay-bookmark-btn"
            title={bookmarked ? 'Remove from relays' : 'Bookmark relay'}
            onclick={() => onToggleBookmark()}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill={bookmarked ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="1.5">
              <path d="M5 2h14a1 1 0 0 1 1 1v19.143a.5.5 0 0 1-.766.424L12 18.03l-7.234 4.536A.5.5 0 0 1 4 22.143V3a1 1 0 0 1 1-1z"/>
            </svg>
          </button>
        {/if}
      </div>
    {/if}
  </div>
  {#if onRemove}
    <button
      class="relay-bookmark-btn relay-bookmark-btn-remove"
      title="Remove relay"
      onclick={() => onRemove()}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.5">
        <path d="M5 2h14a1 1 0 0 1 1 1v19.143a.5.5 0 0 1-.766.424L12 18.03l-7.234 4.536A.5.5 0 0 1 4 22.143V3a1 1 0 0 1 1-1z"/>
      </svg>
    </button>
  {/if}
</div>
{/if}
