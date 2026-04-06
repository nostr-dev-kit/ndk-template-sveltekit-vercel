<script lang="ts">
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { NDKNip07Signer, NDKNip46Signer, NDKPrivateKeySigner } from '@nostr-dev-kit/ndk';
  import { onDestroy } from 'svelte';
  import QRCode from 'qrcode';
  import * as Dialog from '$lib/components/ui/dialog';
  import { APP_NAME } from '$lib/ndk/config';
  import { cleanText, displayName } from '$lib/ndk/format';
  import { ndk } from '$lib/ndk/client';

  let open = $state(false);
  let mode = $state<'extension' | 'private-key' | 'remote'>('extension');
  let pending = $state(false);
  let preparingRemoteSigner = $state(false);
  let connectingBunker = $state(false);
  let loginIntent = $state<'login' | 'join'>('login');
  let privateKey = $state('');
  let bunkerUri = $state('');
  let qrCodeDataUrl = $state('');
  let nostrConnectUri = $state('');
  let nostrConnectSigner: NDKNip46Signer | null = $state(null);
  let error = $state('');
  const currentUser = $derived(ndk.$currentUser);
  const hasExtension = $derived(browser && typeof window !== 'undefined' && 'nostr' in window);
  const remoteSignerReady = $derived(Boolean(qrCodeDataUrl && nostrConnectUri));
  const currentUserLabel = $derived.by(() => {
    if (!currentUser) return '';

    return (
      displayName(currentUser.profile ?? undefined, '') ||
      cleanText(currentUser.profile?.nip05) ||
      'Signed in'
    );
  });

  function resetRemoteSigner() {
    bunkerUri = '';
    qrCodeDataUrl = '';
    nostrConnectUri = '';
    preparingRemoteSigner = false;
    connectingBunker = false;

    if (nostrConnectSigner) {
      nostrConnectSigner.stop();
      nostrConnectSigner = null;
    }
  }

  $effect(() => {
    if (!open) {
      error = '';
      pending = false;
      privateKey = '';
      loginIntent = 'login';
      resetRemoteSigner();
    }
  });

  $effect(() => {
    if (mode !== 'remote') {
      resetRemoteSigner();
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
    if (!ndk.$sessions || pending || !hasExtension) return;

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
    if (!ndk || preparingRemoteSigner || connectingBunker) return;

    try {
      error = '';
      preparingRemoteSigner = true;
      resetRemoteSigner();
      preparingRemoteSigner = true;

      const signer = NDKNip46Signer.nostrconnect(ndk, 'wss://relay.nsec.app', undefined, {
        name: APP_NAME
      });

      nostrConnectSigner = signer;
      nostrConnectUri = signer.nostrConnectUri || '';

      if (!nostrConnectUri) {
        throw new Error("Couldn't create a connection QR code.");
      }

      qrCodeDataUrl = await QRCode.toDataURL(nostrConnectUri, {
        width: 256,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      });

      signer
        .blockUntilReady()
        .then(async () => {
          if (nostrConnectSigner !== signer || !ndk.$sessions) return;

          await ndk.$sessions.login(signer);
          await finishLogin();
        })
        .catch((caught) => {
          if (nostrConnectSigner !== signer) return;
          error = caught instanceof Error ? caught.message : "Couldn't finish connecting to that app.";
        });
    } catch (caught) {
      error = caught instanceof Error ? caught.message : "Couldn't start pairing with another app.";
      resetRemoteSigner();
    } finally {
      preparingRemoteSigner = false;
    }
  }

  async function loginWithBunker() {
    if (!ndk.$sessions || connectingBunker || !bunkerUri.trim().startsWith('bunker://')) return;

    try {
      error = '';
      connectingBunker = true;

      if (nostrConnectSigner) {
        nostrConnectSigner.stop();
        nostrConnectSigner = null;
      }

      const signer = new NDKNip46Signer(ndk, bunkerUri.trim());
      await ndk.$sessions.login(signer);
      await finishLogin();
    } catch (caught) {
      error = caught instanceof Error ? caught.message : "Couldn't use that connection link.";
    } finally {
      connectingBunker = false;
    }
  }

  async function logout() {
    ndk.$sessions?.logout();
    await goto('/');
  }

  onDestroy(() => {
    resetRemoteSigner();
  });
</script>

{#if currentUser}
  <div class="login-shell">
    <div class="status-pill status-green">Signed in</div>
    <div class="actions">
      <span class="muted">{currentUserLabel}</span>
      <a class="button-secondary" href={`/profile/${currentUser.npub}`}>Profile</a>
      <button class="button-secondary" type="button" onclick={logout}>Log out</button>
    </div>
  </div>
{:else}
  <div class="login-shell">
    <Dialog.Root bind:open>
      <div class="topbar-guest-actions">
        <button class="button login-join" type="button" onclick={startJoin}>Join</button>
        <Dialog.Trigger class="button-secondary login-trigger" onclick={startLogin}>Log in</Dialog.Trigger>
      </div>

      <Dialog.Content class="login-dialog">
        <div class="login-dialog-chrome">
          <div class="login-dialog-handle" aria-hidden="true"></div>

          <Dialog.Header class="login-dialog-header">
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

        <div class="login-dialog-body">
          <div class="switcher">
            <button
              class:active={mode === 'extension'}
              class="switcher-button"
              type="button"
              onclick={() => (mode = 'extension')}
            >
              Extension
            </button>
            <button
              class:active={mode === 'private-key'}
              class="switcher-button"
              type="button"
              onclick={() => (mode = 'private-key')}
            >
              Secret key
            </button>
            <button
              class:active={mode === 'remote'}
              class="switcher-button"
              type="button"
              onclick={() => (mode = 'remote')}
            >
              Another app
            </button>
          </div>

          {#if mode === 'extension'}
            <div class="stack">
              <p class="muted" style="margin: 0;">
                Use a browser extension you already trust.
              </p>
              <div class={`status-pill ${hasExtension ? 'status-green' : 'status-yellow'}`}>
                {hasExtension ? 'Extension ready' : 'Extension not found'}
              </div>
              <button class="button login-action" type="button" onclick={loginWithExtension} disabled={pending || !hasExtension}>
                {pending ? 'Connecting...' : 'Continue with extension'}
              </button>
            </div>
          {:else if mode === 'private-key'}
            <div class="stack">
              <label class="field">
                <span class="muted">Secret key</span>
                <textarea bind:value={privateKey} placeholder="Paste your secret key"></textarea>
              </label>
              <button
                class="button login-action"
                type="button"
                onclick={loginWithPrivateKey}
                disabled={pending || !privateKey.trim()}
              >
                {pending ? 'Signing in...' : 'Continue with key'}
              </button>
            </div>
          {:else}
            <div class="stack">
              <p class="muted" style="margin: 0;">
                Pair with another app. Show a QR code to approve this session, or paste a connection
                link.
              </p>

              {#if remoteSignerReady}
                <div class="nip46-qr-shell">
                  <a
                    class="nip46-qr-button"
                    href={nostrConnectUri}
                    title="Open in app"
                  >
                    <img class="nip46-qr-image" src={qrCodeDataUrl} alt="Connection QR code" />
                  </a>
                  <div class="status-pill status-blue nip46-status">Waiting for approval</div>
                  <p class="caption nip46-caption">
                    Open the QR in another app on this device, or scan it from another one.
                  </p>
                </div>
              {:else}
                <div class="stack tight">
                  <button
                    class="button login-action"
                    type="button"
                    onclick={startRemoteSigner}
                    disabled={preparingRemoteSigner || connectingBunker}
                  >
                    {preparingRemoteSigner ? 'Preparing QR...' : 'Show QR code'}
                  </button>
                  <p class="caption nip46-caption">
                    This starts a one-time pairing request and waits for approval.
                  </p>
                </div>
              {/if}

              <div class="login-divider">
                <span>Or paste a link</span>
              </div>

              <label class="field">
                <span class="muted">Connection link</span>
                <input bind:value={bunkerUri} placeholder="Paste a connection link" />
              </label>
              <button
                class="button login-action"
                type="button"
                onclick={loginWithBunker}
                disabled={connectingBunker || !bunkerUri.trim().startsWith('bunker://')}
              >
                {connectingBunker ? 'Connecting...' : 'Continue with link'}
              </button>
            </div>
          {/if}

          {#if error}
            <p class="error" style="margin: 0;">{error}</p>
          {/if}
        </div>
      </Dialog.Content>
    </Dialog.Root>
  </div>
{/if}
