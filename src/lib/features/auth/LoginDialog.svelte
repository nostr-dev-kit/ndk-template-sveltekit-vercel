<script lang="ts">
  import { goto } from '$app/navigation';
  import { NDKNip07Signer, NDKNip46Signer, NDKPrivateKeySigner } from '@nostr-dev-kit/ndk';
  import { onDestroy } from 'svelte';
  import * as Dialog from '$lib/components/ui/dialog';
  import { ndk } from '$lib/ndk/client';
  import ExtensionLoginForm from './ExtensionLoginForm.svelte';
  import PrivateKeyLoginForm from './PrivateKeyLoginForm.svelte';
  import RemoteLoginForm from './RemoteLoginForm.svelte';
  import {
    hasNostrExtension,
    prepareRemoteSignerPairing,
    stopNostrConnectSigner,
    type LoginIntent,
    type LoginMode
  } from './auth';

  let open = $state(false);
  let mode = $state<LoginMode>('extension');
  let loginIntent = $state<LoginIntent>('login');
  let pending = $state(false);
  let preparingRemoteSigner = $state(false);
  let connectingBunker = $state(false);
  let privateKey = $state('');
  let bunkerUri = $state('');
  let qrCodeDataUrl = $state('');
  let nostrConnectUri = $state('');
  let nostrConnectSigner: NDKNip46Signer | null = $state(null);
  let error = $state('');

  const extensionAvailable = $derived(hasNostrExtension());
  const remoteSignerReady = $derived(Boolean(qrCodeDataUrl && nostrConnectUri));

  function clearRemoteSigner() {
    bunkerUri = '';
    qrCodeDataUrl = '';
    nostrConnectUri = '';
    connectingBunker = false;
    stopNostrConnectSigner(nostrConnectSigner);
    nostrConnectSigner = null;
  }

  function resetDialogState() {
    error = '';
    pending = false;
    privateKey = '';
    loginIntent = 'login';
    mode = 'extension';
    preparingRemoteSigner = false;
    clearRemoteSigner();
  }

  $effect(() => {
    if (!open) {
      resetDialogState();
    }
  });

  $effect(() => {
    if (mode !== 'remote') {
      preparingRemoteSigner = false;
      clearRemoteSigner();
    }
  });

  async function finishLogin() {
    const shouldRouteToOnboarding = loginIntent === 'join';
    open = false;

    if (shouldRouteToOnboarding) {
      await goto('/onboarding');
    }
  }

  function startJoin() {
    loginIntent = 'join';
    open = true;
  }

  function startLogin() {
    loginIntent = 'login';
  }

  async function loginWithExtension() {
    if (!ndk.$sessions || pending || !extensionAvailable) return;

    try {
      pending = true;
      error = '';
      await ndk.$sessions.login(new NDKNip07Signer());
      await finishLogin();
    } catch (caught) {
      error = caught instanceof Error ? caught.message : "Couldn't log in with the extension.";
    } finally {
      pending = false;
    }
  }

  async function loginWithPrivateKey() {
    if (!ndk.$sessions || pending || !privateKey.trim()) return;

    try {
      pending = true;
      error = '';
      await ndk.$sessions.login(new NDKPrivateKeySigner(privateKey.trim()));
      await finishLogin();
    } catch (caught) {
      error = caught instanceof Error ? caught.message : "Couldn't log in with that key.";
    } finally {
      pending = false;
    }
  }

  async function startRemoteSigner() {
    if (!ndk.$sessions || preparingRemoteSigner || connectingBunker) return;

    try {
      error = '';
      clearRemoteSigner();
      preparingRemoteSigner = true;

      const pairing = await prepareRemoteSignerPairing(ndk);
      nostrConnectSigner = pairing.signer;
      nostrConnectUri = pairing.nostrConnectUri;
      qrCodeDataUrl = pairing.qrCodeDataUrl;

      pairing.signer
        .blockUntilReady()
        .then(async () => {
          if (nostrConnectSigner !== pairing.signer || !ndk.$sessions) return;

          await ndk.$sessions.login(pairing.signer);
          await finishLogin();
        })
        .catch((caught) => {
          if (nostrConnectSigner !== pairing.signer) return;
          error = caught instanceof Error ? caught.message : "Couldn't finish connecting to that app.";
        });
    } catch (caught) {
      error = caught instanceof Error ? caught.message : "Couldn't start pairing with another app.";
      clearRemoteSigner();
    } finally {
      preparingRemoteSigner = false;
    }
  }

  async function loginWithBunker() {
    if (!ndk.$sessions || connectingBunker || !bunkerUri.trim().startsWith('bunker://')) return;

    try {
      error = '';
      connectingBunker = true;
      stopNostrConnectSigner(nostrConnectSigner);
      nostrConnectSigner = null;
      await ndk.$sessions.login(new NDKNip46Signer(ndk, bunkerUri.trim()));
      await finishLogin();
    } catch (caught) {
      error = caught instanceof Error ? caught.message : "Couldn't use that connection link.";
    } finally {
      connectingBunker = false;
    }
  }

  onDestroy(() => {
    stopNostrConnectSigner(nostrConnectSigner);
  });
</script>

<div class="auth-panel">
  <Dialog.Root bind:open>
    <div class="auth-guest-actions">
      <button class="button auth-join" type="button" onclick={startJoin}>Join</button>
      <Dialog.Trigger class="button-secondary auth-trigger" onclick={startLogin}>Log in</Dialog.Trigger>
    </div>

    <Dialog.Content class="auth-dialog">
      <div class="auth-dialog-chrome">
        <div class="auth-dialog-handle" aria-hidden="true"></div>

        <Dialog.Header class="auth-dialog-header">
          <Dialog.Title>Log in</Dialog.Title>
          <Dialog.Description>
            Choose how you want to log in. Your session stays on this device.
          </Dialog.Description>
        </Dialog.Header>

        <Dialog.Close class="dialog-close" aria-label="Close login">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </Dialog.Close>
      </div>

      <div class="auth-dialog-body">
        <div class="auth-switcher" role="tablist" aria-label="Login methods">
          <button
            class:active={mode === 'extension'}
            class="button-secondary auth-switcher-button"
            type="button"
            onclick={() => (mode = 'extension')}
          >
            Extension
          </button>
          <button
            class:active={mode === 'private-key'}
            class="button-secondary auth-switcher-button"
            type="button"
            onclick={() => (mode = 'private-key')}
          >
            Secret key
          </button>
          <button
            class:active={mode === 'remote'}
            class="button-secondary auth-switcher-button"
            type="button"
            onclick={() => (mode = 'remote')}
          >
            Another app
          </button>
        </div>

        {#if mode === 'extension'}
          <ExtensionLoginForm
            hasExtension={extensionAvailable}
            {pending}
            onLogin={loginWithExtension}
          />
        {:else if mode === 'private-key'}
          <PrivateKeyLoginForm bind:secretKey={privateKey} {pending} onLogin={loginWithPrivateKey} />
        {:else}
          <RemoteLoginForm
            bind:bunkerUri
            {connectingBunker}
            {nostrConnectUri}
            {preparingRemoteSigner}
            {qrCodeDataUrl}
            {remoteSignerReady}
            onLoginWithBunker={loginWithBunker}
            onStartRemoteSigner={startRemoteSigner}
          />
        {/if}

        {#if error}
          <p class="error" style="margin: 0;">{error}</p>
        {/if}
      </div>
    </Dialog.Content>
  </Dialog.Root>
</div>
