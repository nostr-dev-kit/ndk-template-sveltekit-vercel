<script lang="ts">
  import './auth.css';
  import { goto } from '$app/navigation';
  import { NDKKind, type NDKEvent, type NDKUserProfile } from '@nostr-dev-kit/ndk';
  import { ndk } from '$lib/ndk/client';
  import LoginDialog from './LoginDialog.svelte';
  import { authProfileHref, authUserLabel, fetchResolvedProfile, needsOnboarding } from './auth';

  let resolvedProfile: NDKUserProfile | undefined = $state();
  let loadingProfile = $state(false);

  const currentUser = $derived(ndk.$currentUser);
  const currentProfile = $derived(resolvedProfile ?? currentUser?.profile ?? undefined);
  const interestEvent = $derived(ndk.$sessions?.getSessionEvent(NDKKind.InterestList));
  const isReadOnly = $derived(Boolean(ndk.$sessions?.isReadOnly()));
  const currentUserLabel = $derived(authUserLabel(currentProfile));
  const shouldFinishOnboarding = $derived(
    needsOnboarding({
      user: currentUser,
      profile: currentProfile,
      isReadOnly,
      interestEvent: interestEvent as NDKEvent | null | undefined
    })
  );
  const currentProfileHref = $derived(
    currentUser ? authProfileHref(currentProfile, currentUser.npub) : '/'
  );

  $effect(() => {
    if (!currentUser?.pubkey) {
      resolvedProfile = undefined;
      loadingProfile = false;
      return;
    }

    if (currentUser.profile) {
      resolvedProfile = currentUser.profile;
      return;
    }

    if (loadingProfile) return;

    const activePubkey = currentUser.pubkey;
    loadingProfile = true;

    void fetchResolvedProfile(currentUser)
      .then((profile) => {
        if (currentUser?.pubkey !== activePubkey) return;
        resolvedProfile = profile;
      })
      .finally(() => {
        if (currentUser?.pubkey === activePubkey) {
          loadingProfile = false;
        }
      });
  });

  async function logout() {
    ndk.$sessions?.logout();
    await goto('/');
  }
</script>

{#if currentUser}
  <div class="auth-panel">
    <div class="auth-actions">
      <span class="muted auth-user-label">{currentUserLabel}</span>
      {#if shouldFinishOnboarding}
        <a class="button-secondary" href="/onboarding">Finish setup</a>
      {/if}
      <a class="button-secondary" href={currentProfileHref}>Profile</a>
      <button class="button-secondary" type="button" onclick={logout}>Log out</button>
    </div>
  </div>
{:else}
  <LoginDialog />
{/if}
