<script lang="ts">
  import type { NDKUser, NDKUserProfile } from '@nostr-dev-kit/ndk';
  import { goto } from '$app/navigation';
  import * as Avatar from '$lib/components/ui/avatar';
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
  import {
    authUserAvatar,
    authUserInitials,
    authUserLabel,
    authUserMeta
  } from './auth';

  interface Props {
    user: NDKUser;
    profile: NDKUserProfile | undefined;
    profileHref: string;
    shouldFinishOnboarding: boolean;
    onLogout: () => Promise<void>;
  }

  let { user, profile, profileHref, shouldFinishOnboarding, onLogout }: Props = $props();

  const userLabel = $derived(authUserLabel(profile));
  const userMeta = $derived(authUserMeta(profile, user.npub || user.pubkey || ''));
  const userAvatar = $derived(authUserAvatar(profile));
  const userInitials = $derived(authUserInitials(profile));

  function navigateToProfile() {
    void goto(profileHref);
  }

  function navigateToOnboarding() {
    void goto('/onboarding');
  }

  function handleLogout() {
    void onLogout();
  }
</script>

<div class="auth-panel auth-panel-user">
  <DropdownMenu.Root>
    <DropdownMenu.Trigger class="auth-user-trigger" aria-label="Open account menu">
      <Avatar.Root class="auth-user-avatar">
        {#if userAvatar}
          <Avatar.Image src={userAvatar} alt={userLabel} />
        {/if}
        <Avatar.Fallback class="auth-user-avatar-fallback">{userInitials}</Avatar.Fallback>
      </Avatar.Root>

      <span class="auth-user-copy">
        <span class="auth-user-name">{userLabel}</span>
        <span class="auth-user-meta">{userMeta}</span>
      </span>

      <svg class="auth-user-chevron" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6.75 9.75 12 15l5.25-5.25" />
      </svg>
    </DropdownMenu.Trigger>

    <DropdownMenu.Content class="auth-user-menu-content">
      <div class="auth-user-menu-header">
        <Avatar.Root class="auth-menu-avatar">
          {#if userAvatar}
            <Avatar.Image src={userAvatar} alt={userLabel} />
          {/if}
          <Avatar.Fallback class="auth-user-avatar-fallback">{userInitials}</Avatar.Fallback>
        </Avatar.Root>

        <div class="auth-menu-copy">
          <span class="auth-menu-name">{userLabel}</span>
          <span class="auth-menu-meta">{userMeta}</span>
        </div>
      </div>

      <DropdownMenu.Separator />

      <DropdownMenu.Item onSelect={navigateToProfile}>
        <svg class="auth-menu-item-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-3.314 0-6 1.79-6 4v1h12v-1c0-2.21-2.686-4-6-4Z"
          />
        </svg>
        <span>Profile</span>
      </DropdownMenu.Item>

      {#if shouldFinishOnboarding}
        <DropdownMenu.Item onSelect={navigateToOnboarding}>
          <svg class="auth-menu-item-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2Zm-1.1 14.3L7.6 13l1.4-1.4 1.9 1.9 4.8-4.8 1.4 1.4Z"
            />
          </svg>
          <span>Finish setup</span>
        </DropdownMenu.Item>
      {/if}

      <DropdownMenu.Item class="auth-menu-item-danger" onSelect={handleLogout}>
        <svg class="auth-menu-item-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M10 17v-2h4V9h-4V7h7v10Zm-1.4 2L3.3 13.7a2 2 0 0 1 0-2.8L8.6 5.6 10 7l-4.2 4.2a1 1 0 0 0 0 1.4L10 16.8Z"
          />
        </svg>
        <span>Log out</span>
      </DropdownMenu.Item>
    </DropdownMenu.Content>
  </DropdownMenu.Root>
</div>
