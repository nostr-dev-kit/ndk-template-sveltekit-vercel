<script lang="ts">
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { NDKNip07Signer, NDKNip46Signer, NDKPrivateKeySigner } from '@nostr-dev-kit/ndk';
  import { onDestroy } from 'svelte';
  import QRCode from 'qrcode';
  import * as Dialog from '$lib/components/ui/dialog';
  import { APP_NAME } from '$lib/ndk/config';
  import { ndk } from '$lib/ndk/client';

  let open = $state(false);
  let mode = $state<'extension' | 'private-key' | 'remote'>('extension');
  let pending = $state(false);
  let preparingRemoteSigner = $state(false);
  let connectingBunker = $state(false);
  let privateKey = $state('');
  let bunkerUri = $state('');
  let qrCodeDataUrl = $state('');
  let nostrConnectUri = $state('');
  let nostrConnectSigner: NDKNip46Signer | null = $state(null);
  let error = $state('');
  const currentUser = $derived(ndk.$currentUser);
  const hasExtension = $derived(browser && typeof window !== 'undefined' && 'nostr' in window);
  const remoteSignerReady = $derived(Boolean(qrCodeDataUrl && nostrConnectUri));

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
      resetRemoteSigner();
    }
  });

  $effect(() => {
    if (mode !== 'remote') {
      resetRemoteSigner();
    }
  });

  async function loginWithExtension() {
    if (!ndk.$sessions || pending) return;

    try {
      pending = true;
      error = '';
      await ndk.$sessions.login(new NDKNip07Signer());
      open = false;
    } catch (caught) {
      error = caught instanceof Error ? caught.message : 'Extension login failed.';
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
      open = false;
    } catch (caught) {
      error = caught instanceof Error ? caught.message : 'Private-key login failed.';
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
        throw new Error('Failed to generate nostrconnect URI.');
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
          open = false;
        })
        .catch((caught) => {
          if (nostrConnectSigner !== signer) return;
          error = caught instanceof Error ? caught.message : 'Failed to connect via nostrconnect://';
        });
    } catch (caught) {
      error = caught instanceof Error ? caught.message : 'Failed to initialize remote signer.';
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
      open = false;
    } catch (caught) {
      error = caught instanceof Error ? caught.message : 'Failed to connect to bunker.';
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
    <div class="status-pill status-green">Active session</div>
    <div class="actions">
      <span class="mono-inline">{currentUser.npub.slice(0, 18)}...</span>
      <a class="button-secondary" href={`/profile/${currentUser.npub}`}>Profile</a>
      <button class="button-secondary" type="button" onclick={logout}>Log out</button>
    </div>
  </div>
{:else}
  <div class="login-shell">
    <Dialog.Root bind:open>
      <Dialog.Trigger class="button-secondary login-trigger">Connect signer</Dialog.Trigger>

      <Dialog.Content class="login-dialog">
        <div class="login-dialog-chrome">
          <div class="login-dialog-handle" aria-hidden="true"></div>

          <Dialog.Header class="login-dialog-header">
            <Dialog.Title>Connect a signer</Dialog.Title>
            <Dialog.Description>
              Use an extension, a private key, or a remote signer over NIP-46. The session stays in browser storage.
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
              Private key
            </button>
            <button
              class:active={mode === 'remote'}
              class="switcher-button"
              type="button"
              onclick={() => (mode = 'remote')}
            >
              Remote
            </button>
          </div>

          {#if mode === 'extension'}
            <div class="stack">
              <p class="muted" style="margin: 0;">
                Use a browser signer that supports <kbd>NIP-07</kbd>.
              </p>
              <div class={`status-pill ${hasExtension ? 'status-green' : 'status-yellow'}`}>
                {hasExtension ? 'Extension detected' : 'No extension detected'}
              </div>
              <button class="button login-action" type="button" onclick={loginWithExtension} disabled={pending}>
                {pending ? 'Connecting...' : 'Connect extension'}
              </button>
            </div>
          {:else if mode === 'private-key'}
            <div class="stack">
              <label class="field">
                <span class="muted">nsec or hex private key</span>
                <textarea bind:value={privateKey} placeholder="nsec1... or 64-char hex"></textarea>
              </label>
              <button
                class="button login-action"
                type="button"
                onclick={loginWithPrivateKey}
                disabled={pending || !privateKey.trim()}
              >
                {pending ? 'Signing in...' : 'Login with private key'}
              </button>
            </div>
          {:else}
            <div class="stack">
              <p class="muted" style="margin: 0;">
                Connect a remote signer with <kbd>NIP-46</kbd>. Generate a clickable
                <kbd>nostrconnect://</kbd> QR, or paste a <kbd>bunker://</kbd> secret.
              </p>

              {#if remoteSignerReady}
                <div class="nip46-qr-shell">
                  <a
                    class="nip46-qr-button"
                    href={nostrConnectUri}
                    title="Open in signer app"
                  >
                    <img class="nip46-qr-image" src={qrCodeDataUrl} alt="Nostrconnect QR code" />
                  </a>
                  <div class="status-pill status-blue nip46-status">Waiting for signer approval</div>
                  <p class="caption nip46-caption">
                    Click the QR to open <kbd>nostrconnect://</kbd> in a local signer app, or scan
                    it from another device.
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
                    {preparingRemoteSigner ? 'Generating QR...' : 'Generate nostrconnect QR'}
                  </button>
                  <p class="caption nip46-caption">
                    This creates a local secret and waits for a signer app to approve the session.
                  </p>
                </div>
              {/if}

              <div class="login-divider">
                <span>Or paste bunker URI</span>
              </div>

              <label class="field">
                <span class="muted">bunker:// secret</span>
                <input bind:value={bunkerUri} placeholder="bunker://..." />
              </label>
              <button
                class="button login-action"
                type="button"
                onclick={loginWithBunker}
                disabled={connectingBunker || !bunkerUri.trim().startsWith('bunker://')}
              >
                {connectingBunker ? 'Connecting...' : 'Connect bunker'}
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
