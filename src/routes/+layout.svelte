<script lang="ts">
  import { onMount, setContext } from 'svelte';
  import type { LayoutProps } from './$types';
  import '../app.css';
  import LoginPanel from '$lib/components/LoginPanel.svelte';
  import SeoHead from '$lib/components/SeoHead.svelte';
  import { ndk, ensureClientNdk } from '$lib/ndk/client';
  import type { SeoMetadata } from '$lib/seo';
  import { NDK_CONTEXT_KEY } from '$lib/ndk/utils/ndk';

  let { children, data }: LayoutProps = $props();
  const seo = $derived((data as { seo?: SeoMetadata }).seo);

  setContext(NDK_CONTEXT_KEY, ndk);

  onMount(() => {
    void ensureClientNdk().catch((error) => {
      console.error('Failed to connect client NDK', error);
    });
  });
</script>

{#if seo}
  <SeoHead {seo} />
{/if}

<div class="ambient-layer" aria-hidden="true"></div>

<div class="topbar">
  <div class="shell topbar-inner">
    <a class="brand" href="/">
      <span class="brand-mark">R</span>
      <span class="brand-copy">
        <span class="brand-name">Relay Press</span>
        <span class="brand-note">Long-form Nostr demo built from the template</span>
      </span>
    </a>

    <div class="nav-links">
      <a href="/">Read</a>
      <a href="/about">About the template</a>
      <a href="/profile/fiatjaf.com">Author page</a>
    </div>

    <LoginPanel />
  </div>
</div>

<main class="shell page">
  {@render children()}
</main>

<footer class="shell footer">
  <div class="footer-grid">
    <span>A long-form Nostr demo that keeps shareable routes separate from live client state.</span>
    <span>Relays are configured through <kbd>PUBLIC_NOSTR_RELAYS</kbd>.</span>
  </div>
</footer>
