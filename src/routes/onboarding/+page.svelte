<script lang="ts">
  import { goto } from '$app/navigation';
  import {
    NDKBlossomList,
    NDKInterestList,
    NDKKind,
    NDKNip07Signer,
    NDKNip46Signer,
    NDKPrivateKeySigner,
    type NDKEvent,
    type NDKUserProfile
  } from '@nostr-dev-kit/ndk';
  import { onDestroy } from 'svelte';
  import { cleanText, displayName, profileIdentifier } from '$lib/ndk/format';
  import { ndk, ensureClientNdk } from '$lib/ndk/client';
  import {
    DEFAULT_BLOSSOM_SERVER,
    INTEREST_SUGGESTIONS,
    blossomServerFromEvent,
    interestTagsFromEvent,
    mergeBlossomServers,
    normalizeInterestTag,
    normalizeInterestTags,
    onboardingComplete,
    parseBlossomServer
  } from '$lib/onboarding';
  import { hasNostrExtension, prepareRemoteSignerPairing, stopNostrConnectSigner } from '$lib/features/auth/auth';

  // ── wizard step ────────────────────────────────────────────────
  let step = $state<1 | 2 | 3>(1);

  // ── profile fields ─────────────────────────────────────────────
  let activePubkey = $state<string | null>(null);
  let resolvedProfile: NDKUserProfile | undefined = $state();
  let name = $state('');
  let display = $state('');
  let about = $state('');
  let website = $state('');
  let blossomServer = $state(DEFAULT_BLOSSOM_SERVER);
  let selectedInterests: string[] = $state([]);
  let customInterest = $state('');
  let avatarUrl = $state('');
  let avatarFile: File | null = $state(null);
  let avatarPreviewUrl = $state('');
  let profileTouched = $state(false);
  let interestsTouched = $state(false);
  let blossomTouched = $state(false);
  let profileLoading = $state(false);
  let uploadingAvatar = $state(false);
  let saving = $state(false);
  let uploadProgress = $state<number | null>(null);
  let saveError = $state('');
  let uploadError = $state('');
  let fileInput: HTMLInputElement | null = $state(null);

  // ── auth (step 3) ───────────────────────────────────────────────
  let authMode = $state<'extension' | 'private-key' | 'remote'>('extension');
  let privateKey = $state('');
  let bunkerUri = $state('');
  let qrCodeDataUrl = $state('');
  let nostrConnectUri = $state('');
  let nostrConnectSigner: NDKNip46Signer | null = $state(null);
  let authPending = $state(false);
  let preparingRemoteSigner = $state(false);
  let connectingBunker = $state(false);
  let authError = $state('');

  // ── derived ─────────────────────────────────────────────────────
  const currentUser = $derived(ndk.$currentUser);
  const currentSession = $derived(ndk.$sessions?.current);
  const interestEvent = $derived(ndk.$sessions?.getSessionEvent(NDKKind.InterestList));
  const blossomEvent = $derived(ndk.$sessions?.getSessionEvent(NDKKind.BlossomList));
  const isReadOnly = $derived(Boolean(ndk.$sessions?.isReadOnly()));
  const avatarDisplayUrl = $derived(avatarPreviewUrl || avatarUrl);
  const normalizedInterests = $derived(normalizeInterestTags(selectedInterests));
  const extensionAvailable = $derived(hasNostrExtension());
  const canPublish = $derived(Boolean(currentUser) && !isReadOnly && !saving && !uploadingAvatar);
  const writerLabel = $derived(
    displayName(
      {
        ...(resolvedProfile ?? {}),
        name: cleanText(name) || resolvedProfile?.name,
        displayName: cleanText(display) || resolvedProfile?.displayName
      },
      'You'
    )
  );
  const step1Valid = $derived(Boolean(cleanText(name) || cleanText(display)));
  const step2Valid = $derived(normalizedInterests.length > 0);

  // ── profile helpers ─────────────────────────────────────────────
  function clearMessages() {
    saveError = '';
    uploadError = '';
    authError = '';
  }

  function clearAvatarPreview() {
    if (avatarPreviewUrl) {
      URL.revokeObjectURL(avatarPreviewUrl);
      avatarPreviewUrl = '';
    }
  }

  function resetDraft() {
    resolvedProfile = undefined;
    name = '';
    display = '';
    about = '';
    website = '';
    blossomServer = DEFAULT_BLOSSOM_SERVER;
    selectedInterests = [];
    customInterest = '';
    avatarUrl = '';
    avatarFile = null;
    clearAvatarPreview();
    if (fileInput) fileInput.value = '';
  }

  function seedProfile(profile: NDKUserProfile | undefined) {
    resolvedProfile = profile ? { ...profile } : undefined;
    if (profileTouched) return;
    name = cleanText(profile?.name);
    display = cleanText(profile?.displayName);
    about = cleanText(profile?.about || profile?.bio);
    website = cleanText(profile?.website);
    avatarUrl = cleanText(profile?.picture || profile?.image);
  }

  function toggleInterest(value: string) {
    const normalized = normalizeInterestTag(value);
    if (!normalized) return;
    interestsTouched = true;
    selectedInterests = selectedInterests.includes(normalized)
      ? selectedInterests.filter((i) => i !== normalized)
      : normalizeInterestTags([...selectedInterests, normalized]);
  }

  function addCustomInterest() {
    const normalized = normalizeInterestTag(customInterest);
    if (!normalized) return;
    interestsTouched = true;
    selectedInterests = normalizeInterestTags([...selectedInterests, normalized]);
    customInterest = '';
  }

  function handleCustomInterestKeydown(event: KeyboardEvent) {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    addCustomInterest();
  }

  function handleAvatarClick() {
    fileInput?.click();
  }

  function handleAvatarSelection(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    clearMessages();
    clearAvatarPreview();
    avatarFile = file;
    if (file) avatarPreviewUrl = URL.createObjectURL(file);
    profileTouched = true;
  }

  async function uploadAvatarFile(): Promise<string | null> {
    if (!avatarFile) return avatarUrl || null;

    const hasCustomValue = Boolean(cleanText(blossomServer));
    const parsedServer = parseBlossomServer(blossomServer) ?? (hasCustomValue ? null : DEFAULT_BLOSSOM_SERVER);
    if (!parsedServer) {
      uploadError = 'Enter a valid storage server URL.';
      return null;
    }

    try {
      clearMessages();
      uploadingAvatar = true;
      uploadProgress = 0;
      await ensureClientNdk();

      const { NDKBlossom } = await import('@nostr-dev-kit/blossom');
      const blossom = new NDKBlossom(ndk);
      const descriptor = await blossom.upload(avatarFile, {
        server: parsedServer,
        onProgress: ({ loaded, total }) => {
          uploadProgress = total > 0 ? Math.round((loaded / total) * 100) : null;
          return 'continue';
        }
      });
      const uploadedUrl = descriptor.url;
      if (!uploadedUrl) throw new Error("The storage server didn't return a file URL.");

      avatarUrl = uploadedUrl;
      avatarFile = null;
      blossomTouched = true;
      blossomServer = parsedServer;
      clearAvatarPreview();
      if (fileInput) fileInput.value = '';
      return uploadedUrl;
    } catch (caught) {
      uploadError = caught instanceof Error ? caught.message : "Couldn't upload that picture.";
      return null;
    } finally {
      uploadingAvatar = false;
      uploadProgress = null;
    }
  }

  // ── auth helpers (step 3) ───────────────────────────────────────
  async function loginWithExtension() {
    if (!ndk.$sessions || authPending || !extensionAvailable) return;
    try {
      authPending = true;
      authError = '';
      await ndk.$sessions.login(new NDKNip07Signer());
    } catch (caught) {
      authError = caught instanceof Error ? caught.message : "Couldn't log in with the extension.";
    } finally {
      authPending = false;
    }
  }

  async function loginWithPrivateKey() {
    if (!ndk.$sessions || authPending || !privateKey.trim()) return;
    try {
      authPending = true;
      authError = '';
      await ndk.$sessions.login(new NDKPrivateKeySigner(privateKey.trim()));
    } catch (caught) {
      authError = caught instanceof Error ? caught.message : "Couldn't log in with that key.";
    } finally {
      authPending = false;
    }
  }

  function clearRemoteSigner() {
    bunkerUri = '';
    qrCodeDataUrl = '';
    nostrConnectUri = '';
    connectingBunker = false;
    stopNostrConnectSigner(nostrConnectSigner);
    nostrConnectSigner = null;
  }

  async function startRemoteSigner() {
    if (!ndk.$sessions || preparingRemoteSigner || connectingBunker) return;
    try {
      authError = '';
      clearRemoteSigner();
      preparingRemoteSigner = true;
      const pairing = await prepareRemoteSignerPairing(ndk);
      nostrConnectSigner = pairing.signer;
      nostrConnectUri = pairing.nostrConnectUri;
      qrCodeDataUrl = pairing.qrCodeDataUrl;
      void ndk.$sessions.login(pairing.signer).catch((caught) => {
        if (nostrConnectSigner !== pairing.signer) return;
        authError = caught instanceof Error ? caught.message : "Couldn't connect to that app.";
      });
    } catch (caught) {
      authError = caught instanceof Error ? caught.message : "Couldn't start pairing.";
      clearRemoteSigner();
    } finally {
      preparingRemoteSigner = false;
    }
  }

  // ── publish ─────────────────────────────────────────────────────
  async function publish() {
    if (!currentUser || isReadOnly) return;

    const nextName = cleanText(name);
    const nextDisplay = cleanText(display);
    const nextAbout = cleanText(about);
    const nextWebsite = cleanText(website);
    const nextInterests = normalizeInterestTags(selectedInterests);
    const hasCustomValue = Boolean(cleanText(blossomServer));
    const nextServer = parseBlossomServer(blossomServer) ?? (hasCustomValue ? null : DEFAULT_BLOSSOM_SERVER);

    if (!nextServer) { saveError = 'Enter a valid storage server URL.'; return; }

    let nextAvatar = cleanText(avatarUrl);
    if (avatarFile) {
      const uploadedUrl = await uploadAvatarFile();
      if (!uploadedUrl) { saveError = uploadError || 'Upload failed.'; return; }
      nextAvatar = cleanText(uploadedUrl);
    }

    try {
      clearMessages();
      saving = true;
      await ensureClientNdk();

      const previousProfile = currentUser.profile ? { ...currentUser.profile } : undefined;
      const nextProfile: NDKUserProfile = { ...(currentUser.profile ?? {}) };
      nextProfile.name = nextName || undefined;
      nextProfile.displayName = nextDisplay || undefined;
      nextProfile.about = nextAbout || undefined;
      nextProfile.bio = nextAbout || undefined;
      nextProfile.website = nextWebsite || undefined;
      nextProfile.picture = nextAvatar || undefined;
      nextProfile.image = nextAvatar || undefined;

      currentUser.profile = nextProfile;
      try {
        await currentUser.publish();
      } catch (caught) {
        currentUser.profile = previousProfile;
        throw caught;
      }

      const nextBlossom =
        blossomEvent instanceof NDKBlossomList
          ? blossomEvent
          : blossomEvent
            ? NDKBlossomList.from(blossomEvent as NDKEvent)
            : new NDKBlossomList(ndk);
      nextBlossom.servers = mergeBlossomServers(nextServer, nextBlossom.servers);
      nextBlossom.default = nextServer;
      await nextBlossom.publish();
      currentSession?.events.set(NDKKind.BlossomList, nextBlossom);

      const nextInterestEvent =
        interestEvent instanceof NDKInterestList
          ? interestEvent
          : interestEvent
            ? NDKInterestList.from(interestEvent as NDKEvent)
            : new NDKInterestList(ndk);
      nextInterestEvent.interests = nextInterests;
      await nextInterestEvent.publish();
      currentSession?.events.set(NDKKind.InterestList, nextInterestEvent);

      await goto(`/profile/${profileIdentifier(nextProfile, currentUser.npub)}`);
    } catch (caught) {
      saveError = caught instanceof Error ? caught.message : "Couldn't publish your profile.";
    } finally {
      saving = false;
    }
  }

  // ── effects ─────────────────────────────────────────────────────
  $effect(() => {
    const pubkey = currentUser?.pubkey ?? null;
    if (activePubkey === pubkey) return;
    activePubkey = pubkey;
    profileTouched = false;
    interestsTouched = false;
    blossomTouched = false;
    profileLoading = false;
    clearMessages();
    resetDraft();
    if (currentUser?.profile) seedProfile(currentUser.profile);
  });

  $effect(() => {
    if (!profileTouched) seedProfile(currentUser?.profile ?? resolvedProfile);
  });

  $effect(() => {
    if (!interestsTouched) selectedInterests = interestTagsFromEvent(interestEvent as NDKEvent | null | undefined);
  });

  $effect(() => {
    if (!blossomTouched) blossomServer = blossomServerFromEvent(blossomEvent as NDKEvent | null | undefined);
  });

  $effect(() => {
    if (!currentUser?.pubkey || currentUser.profile || profileLoading) return;
    const targetPubkey = currentUser.pubkey;
    profileLoading = true;
    void currentUser.fetchProfile()
      .then((profile) => {
        if (currentUser?.pubkey !== targetPubkey) return;
        resolvedProfile = profile ?? currentUser.profile ?? undefined;
        if (!profileTouched) seedProfile(profile ?? currentUser.profile ?? undefined);
      })
      .catch(() => {
        if (currentUser?.pubkey !== targetPubkey) return;
        resolvedProfile = currentUser.profile ?? undefined;
      })
      .finally(() => {
        if (currentUser?.pubkey === targetPubkey) profileLoading = false;
      });
  });

  onDestroy(() => {
    clearAvatarPreview();
    stopNostrConnectSigner(nostrConnectSigner);
  });
</script>

<div class="ob-shell">
  <!-- progress -->
  <nav class="ob-progress" aria-label="Setup steps">
    {#each [1, 2, 3] as s (s)}
      <button
        class="ob-progress-step"
        class:active={step === s}
        class:done={step > s}
        type="button"
        onclick={() => { if (s < step || (s === 2 && step1Valid) || (s === 3 && step1Valid && step2Valid)) step = s as 1|2|3; }}
        aria-current={step === s ? 'step' : undefined}
      >
        <span class="ob-progress-dot"></span>
        <span class="ob-progress-label">{['About you', 'Interests', 'Publish'][s - 1]}</span>
      </button>
    {/each}
  </nav>

  <!-- step 1: about you -->
  {#if step === 1}
    <div class="ob-step reveal">
      <div class="ob-step-head">
        <h1>Tell us about yourself</h1>
        <p>This is your public author profile. You can change it anytime.</p>
      </div>

      <div class="ob-step-body">
        <!-- avatar -->
        <div class="ob-avatar-zone">
          <button class="ob-avatar-btn" type="button" onclick={handleAvatarClick} aria-label="Upload photo">
            {#if avatarDisplayUrl}
              <img src={avatarDisplayUrl} alt="Your avatar" class="ob-avatar-img" />
            {:else}
              <div class="ob-avatar-placeholder">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M12 15.5A3.5 3.5 0 1 0 12 8.5a3.5 3.5 0 0 0 0 7Zm0 0v0M15.5 20H8.5A6.5 6.5 0 0 1 2 13.5v0" />
                  <circle cx="12" cy="12" r="10" />
                </svg>
                <span>Add photo</span>
              </div>
            {/if}
            <div class="ob-avatar-overlay">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
              </svg>
            </div>
          </button>
          <input bind:this={fileInput} type="file" accept="image/*" onchange={handleAvatarSelection} class="ob-file-input" tabindex="-1" />
          {#if avatarDisplayUrl}
            <button class="ob-avatar-remove" type="button" onclick={() => { avatarUrl = ''; avatarFile = null; clearAvatarPreview(); if (fileInput) fileInput.value = ''; }}>
              Remove
            </button>
          {/if}
          {#if uploadError}
            <p class="ob-error">{uploadError}</p>
          {/if}
        </div>

        <!-- name fields -->
        <div class="ob-fields">
          <div class="ob-field-row">
            <label class="ob-field">
              <span>Name</span>
              <input
                bind:value={name}
                oninput={() => { profileTouched = true; }}
                placeholder="Your name"
                autocomplete="name"
              />
            </label>
            <label class="ob-field">
              <span>Display name <em>(optional)</em></span>
              <input
                bind:value={display}
                oninput={() => { profileTouched = true; }}
                placeholder="How you want to appear"
              />
            </label>
          </div>

          <label class="ob-field">
            <span>Bio <em>(optional)</em></span>
            <textarea
              bind:value={about}
              oninput={() => { profileTouched = true; }}
              placeholder="What do you write about?"
              rows="3"
            ></textarea>
          </label>

          <label class="ob-field">
            <span>Website <em>(optional)</em></span>
            <input
              bind:value={website}
              oninput={() => { profileTouched = true; }}
              placeholder="https://yoursite.com"
              type="url"
            />
          </label>
        </div>
      </div>

      <div class="ob-step-footer">
        <button
          class="button ob-next"
          type="button"
          disabled={!step1Valid}
          onclick={() => step = 2}
        >
          Next — pick your interests
        </button>
        {#if !step1Valid}
          <p class="ob-hint">Add a name to continue</p>
        {/if}
      </div>
    </div>

  <!-- step 2: interests -->
  {:else if step === 2}
    <div class="ob-step reveal">
      <div class="ob-step-head">
        <h1>What do you write about?</h1>
        <p>Pick as many as you like. This shapes your feed and helps readers find you.</p>
      </div>

      <div class="ob-step-body">
        <div class="ob-interests">
          {#each INTEREST_SUGGESTIONS as interest (interest)}
            <button
              class="ob-interest-chip"
              class:selected={normalizedInterests.includes(interest)}
              type="button"
              onclick={() => toggleInterest(interest)}
            >
              {interest}
            </button>
          {/each}
        </div>

        <div class="ob-custom-interest">
          <input
            bind:value={customInterest}
            placeholder="Add your own topic…"
            onkeydown={handleCustomInterestKeydown}
          />
          <button class="button-secondary" type="button" onclick={addCustomInterest} disabled={!customInterest.trim()}>
            Add
          </button>
        </div>

        {#if normalizedInterests.length > 0}
          <div class="ob-selected-interests">
            {#each normalizedInterests as interest (interest)}
              <button class="ob-selected-chip" type="button" onclick={() => { interestsTouched = true; selectedInterests = selectedInterests.filter(i => i !== interest); }}>
                #{interest} ×
              </button>
            {/each}
          </div>
        {/if}
      </div>

      <div class="ob-step-footer">
        <div class="ob-footer-row">
          <button class="button-secondary" type="button" onclick={() => step = 1}>Back</button>
          <button
            class="button ob-next"
            type="button"
            disabled={!step2Valid}
            onclick={() => step = 3}
          >
            Next — create your account
          </button>
        </div>
        {#if !step2Valid}
          <p class="ob-hint">Pick at least one topic to continue</p>
        {/if}
      </div>
    </div>

  <!-- step 3: connect & publish -->
  {:else}
    <div class="ob-step reveal">
      <div class="ob-step-head">
        {#if currentUser}
          <h1>You're all set, {writerLabel}</h1>
          <p>Review your profile and hit publish.</p>
        {:else}
          <h1>Last step — connect your account</h1>
          <p>Sign in to publish your profile to the network.</p>
        {/if}
      </div>

      <div class="ob-step-body">
        {#if !currentUser}
          <!-- auth options -->
          <div class="ob-auth">
            <div class="ob-auth-tabs">
              <button class="ob-auth-tab" class:active={authMode === 'extension'} type="button" onclick={() => authMode = 'extension'}>Extension</button>
              <button class="ob-auth-tab" class:active={authMode === 'private-key'} type="button" onclick={() => authMode = 'private-key'}>Secret key</button>
              <button class="ob-auth-tab" class:active={authMode === 'remote'} type="button" onclick={() => authMode = 'remote'}>Another app</button>
            </div>

            {#if authMode === 'extension'}
              <div class="ob-auth-panel">
                <p class="ob-auth-desc">Use a Nostr browser extension like Alby or nos2x.</p>
                <button class="button ob-auth-action" type="button" onclick={loginWithExtension} disabled={authPending || !extensionAvailable}>
                  {authPending ? 'Connecting…' : extensionAvailable ? 'Continue with extension' : 'No extension detected'}
                </button>
              </div>

            {:else if authMode === 'private-key'}
              <div class="ob-auth-panel">
                <p class="ob-auth-desc">Paste your nsec or hex private key.</p>
                <textarea class="ob-auth-key" bind:value={privateKey} placeholder="nsec1… or hex key" rows="2"></textarea>
                <button class="button ob-auth-action" type="button" onclick={loginWithPrivateKey} disabled={authPending || !privateKey.trim()}>
                  {authPending ? 'Signing in…' : 'Continue with key'}
                </button>
              </div>

            {:else}
              <div class="ob-auth-panel">
                <p class="ob-auth-desc">Scan with a Nostr signing app or paste a bunker:// link.</p>
                {#if qrCodeDataUrl}
                  <div class="ob-qr">
                    <img src={qrCodeDataUrl} alt="QR code" />
                  </div>
                {/if}
                {#if !qrCodeDataUrl}
                  <button class="button ob-auth-action" type="button" onclick={startRemoteSigner} disabled={preparingRemoteSigner}>
                    {preparingRemoteSigner ? 'Generating…' : 'Show QR code'}
                  </button>
                {/if}
              </div>
            {/if}

            {#if authError}
              <p class="ob-error">{authError}</p>
            {/if}
          </div>
        {/if}

        <!-- profile summary -->
        <div class="ob-summary">
          <div class="ob-summary-avatar">
            {#if avatarDisplayUrl}
              <img src={avatarDisplayUrl} alt="" />
            {:else}
              <span>{writerLabel.slice(0, 1).toUpperCase()}</span>
            {/if}
          </div>
          <div class="ob-summary-info">
            <strong class="ob-summary-name">{writerLabel}</strong>
            {#if cleanText(about)}
              <p class="ob-summary-bio">{cleanText(about)}</p>
            {/if}
            {#if normalizedInterests.length > 0}
              <div class="ob-summary-interests">
                {#each normalizedInterests.slice(0, 5) as interest (interest)}
                  <span class="ob-summary-chip">#{interest}</span>
                {/each}
                {#if normalizedInterests.length > 5}
                  <span class="ob-summary-chip muted">+{normalizedInterests.length - 5} more</span>
                {/if}
              </div>
            {/if}
          </div>
        </div>
      </div>

      <div class="ob-step-footer">
        <div class="ob-footer-row">
          <button class="button-secondary" type="button" onclick={() => step = 2}>Back</button>
          <button
            class="button ob-next"
            type="button"
            disabled={!canPublish}
            onclick={() => void publish()}
          >
            {saving ? 'Publishing…' : 'Publish profile'}
          </button>
        </div>
        {#if !currentUser}
          <p class="ob-hint">Connect an account above to publish</p>
        {/if}
        {#if saveError}
          <p class="ob-error">{saveError}</p>
        {/if}
      </div>
    </div>
  {/if}
</div>
