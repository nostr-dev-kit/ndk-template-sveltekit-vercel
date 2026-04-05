<script lang="ts">
  import type { NDKSvelte } from '@nostr-dev-kit/svelte';
  import { createProfileFetcher } from '$lib/ndk/builders/profile/index.svelte.js';
  import { displayName, displayNip05, profileIdentifier } from '$lib/ndk/format';
  import { User } from '$lib/ndk/ui/user';
  import { untrack } from 'svelte';

  interface Props {
    ndk: NDKSvelte;
    pubkey: string;
    avatarClass?: string;
    compact?: boolean;
  }

  let { ndk, pubkey, avatarClass = '', compact = false }: Props = $props();

  const stableNdk = untrack(() => ndk);
  const profileFetcher = createProfileFetcher(() => ({ user: pubkey }), stableNdk);

  const primaryLabel = $derived.by(() => {
    const profile = profileFetcher.profile ?? undefined;
    return displayName(profile, '') || 'Author';
  });

  const secondaryLabel = $derived.by(() => {
    const nip05 = displayNip05(profileFetcher.profile ?? undefined);
    return nip05 && nip05 !== primaryLabel ? nip05 : '';
  });

  const href = $derived(`/profile/${profileIdentifier(profileFetcher.profile ?? undefined, pubkey)}`);
</script>

<User.Root {ndk} {pubkey} profile={profileFetcher.profile ?? undefined}>
  <a class="story-author-link" href={href}>
    <User.Avatar class={avatarClass} />
    <div class={`story-byline-copy${compact ? ' compact' : ''}`}>
      <strong class="story-author-name">{primaryLabel}</strong>
      {#if secondaryLabel}
        <span class="story-author-handle">{secondaryLabel}</span>
      {/if}
    </div>
  </a>
</User.Root>
