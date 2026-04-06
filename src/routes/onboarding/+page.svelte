<script lang="ts">
  import { goto } from '$app/navigation';
  import {
    NDKBlossomList,
    NDKInterestList,
    NDKKind,
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
  let saveMessage = $state('');
  let fileInput: HTMLInputElement | null = $state(null);

  const currentUser = $derived(ndk.$currentUser);
  const currentSession = $derived(ndk.$sessions?.current);
  const interestEvent = $derived(ndk.$sessions?.getSessionEvent(NDKKind.InterestList));
  const blossomEvent = $derived(ndk.$sessions?.getSessionEvent(NDKKind.BlossomList));
  const isReadOnly = $derived(Boolean(ndk.$sessions?.isReadOnly()));
  const avatarDisplayUrl = $derived(avatarPreviewUrl || avatarUrl);
  const normalizedInterests = $derived(normalizeInterestTags(selectedInterests));
  const onboardingIsComplete = $derived(
    onboardingComplete({
      profile: {
        name: cleanText(name) || undefined,
        displayName: cleanText(display) || undefined
      },
      interests: normalizedInterests
    })
  );
  const canSubmit = $derived(Boolean(currentUser) && !isReadOnly && !saving && !uploadingAvatar);
  const writerLabel = $derived(
    displayName(
      {
        ...(resolvedProfile ?? {}),
        name: cleanText(name) || resolvedProfile?.name,
        displayName: cleanText(display) || resolvedProfile?.displayName
      },
      'Writer'
    )
  );

  function clearMessages() {
    saveError = '';
    uploadError = '';
    saveMessage = '';
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

  function noteProfileEdit() {
    profileTouched = true;
    clearMessages();
  }

  function noteInterestEdit() {
    interestsTouched = true;
    clearMessages();
  }

  function noteBlossomEdit() {
    blossomTouched = true;
    clearMessages();
  }

  function toggleInterest(value: string) {
    const normalized = normalizeInterestTag(value);
    if (!normalized) return;

    noteInterestEdit();
    selectedInterests = selectedInterests.includes(normalized)
      ? selectedInterests.filter((interest) => interest !== normalized)
      : normalizeInterestTags([...selectedInterests, normalized]);
  }

  function addCustomInterest() {
    const normalized = normalizeInterestTag(customInterest);
    if (!normalized) return;

    noteInterestEdit();
    selectedInterests = normalizeInterestTags([...selectedInterests, normalized]);
    customInterest = '';
  }

  function removeInterest(value: string) {
    noteInterestEdit();
    selectedInterests = selectedInterests.filter((interest) => interest !== value);
  }

  function handleCustomInterestKeydown(event: KeyboardEvent) {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    addCustomInterest();
  }

  function handleAvatarSelection(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    clearMessages();
    clearAvatarPreview();
    avatarFile = file;

    if (file) {
      avatarPreviewUrl = URL.createObjectURL(file);
    }
  }

  function removeAvatar() {
    noteProfileEdit();
    avatarUrl = '';
    avatarFile = null;
    clearAvatarPreview();
    if (fileInput) fileInput.value = '';
  }

  async function uploadAvatarFile(): Promise<string | null> {
    if (!avatarFile) return avatarUrl || null;

    const hasCustomValue = Boolean(cleanText(blossomServer));
    const parsedServer = parseBlossomServer(blossomServer) ?? (hasCustomValue ? null : DEFAULT_BLOSSOM_SERVER);
    if (!parsedServer) {
      uploadError = 'Enter a valid Blossom server URL.';
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
      if (!uploadedUrl) {
        throw new Error("The Blossom server didn't return a file URL.");
      }

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

  async function saveOnboarding(event: SubmitEvent) {
    event.preventDefault();

    if (!currentUser || isReadOnly) {
      saveError = 'Log in with a signer before publishing onboarding changes.';
      return;
    }

    const nextName = cleanText(name);
    const nextDisplay = cleanText(display);
    const nextAbout = cleanText(about);
    const nextWebsite = cleanText(website);
    const nextInterests = normalizeInterestTags(selectedInterests);
    const hasCustomValue = Boolean(cleanText(blossomServer));
    const nextServer = parseBlossomServer(blossomServer) ?? (hasCustomValue ? null : DEFAULT_BLOSSOM_SERVER);

    if (!nextName && !nextDisplay) {
      saveError = 'Add a name or display name before publishing.';
      return;
    }

    if (!nextServer) {
      saveError = 'Enter a valid Blossom server URL.';
      return;
    }

    if (nextInterests.length === 0) {
      saveError = 'Choose at least one interest.';
      return;
    }

    let nextAvatar = cleanText(avatarUrl);
    if (avatarFile) {
      const uploadedUrl = await uploadAvatarFile();
      if (!uploadedUrl) {
        saveError = uploadError || 'Upload your avatar before finishing setup.';
        return;
      }
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

      resolvedProfile = { ...nextProfile };
      profileTouched = false;
      interestsTouched = false;
      blossomTouched = false;
      saveMessage = 'Profile published.';

      await goto(`/profile/${profileIdentifier(nextProfile, currentUser.npub)}`);
    } catch (caught) {
      saveError =
        caught instanceof Error ? caught.message : "Couldn't publish your onboarding changes.";
    } finally {
      saving = false;
    }
  }

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

    if (currentUser?.profile) {
      seedProfile(currentUser.profile);
    }
  });

  $effect(() => {
    if (!profileTouched) {
      seedProfile(currentUser?.profile ?? resolvedProfile);
    }
  });

  $effect(() => {
    if (!interestsTouched) {
      selectedInterests = interestTagsFromEvent(interestEvent as NDKEvent | null | undefined);
    }
  });

  $effect(() => {
    if (!blossomTouched) {
      blossomServer = blossomServerFromEvent(blossomEvent as NDKEvent | null | undefined);
    }
  });

  $effect(() => {
    if (!currentUser?.pubkey || currentUser.profile || profileLoading) return;

    const targetPubkey = currentUser.pubkey;
    profileLoading = true;

    void currentUser
      .fetchProfile()
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
        if (currentUser?.pubkey === targetPubkey) {
          profileLoading = false;
        }
      });
  });

  onDestroy(() => {
    clearAvatarPreview();
  });
</script>

{#if !currentUser}
  <section class="section reveal">
    <article class="panel onboarding-empty">
      <span class="eyebrow eyebrow-blue">Onboarding</span>
      <h1>Log in to set up your writer profile.</h1>
      <p class="muted" style="margin: 0;">
        Connect a signer from the top bar, then come back here to publish your profile, avatar,
        and interests.
      </p>
    </article>
  </section>
{:else}
  <section class="section reveal">
    <div class="onboarding-shell">
      <article class="panel onboarding-hero">
        <div class="stack">
          <span class="eyebrow eyebrow-blue">Onboarding</span>
          <div class="onboarding-heading">
            <div>
              <h1>Set up your profile before you publish.</h1>
              <p class="lead-deck">
                Add your kind:0 profile, pick the topics you want to read and write about, and
                store your avatar on Blossom.
              </p>
            </div>

            <div class="onboarding-summary-card">
              <div class={`status-pill ${onboardingIsComplete ? 'status-green' : 'status-yellow'}`}>
                {onboardingIsComplete ? 'Ready to publish' : 'Needs a few details'}
              </div>
              <strong>{writerLabel}</strong>
              <span class="muted">{normalizedInterests.length} interests selected</span>
            </div>
          </div>
        </div>
      </article>

      <div class="onboarding-grid">
        <form class="onboarding-main" onsubmit={saveOnboarding}>
          <article class="panel onboarding-card">
            <div class="onboarding-card-header">
              <div>
                <span class="eyebrow eyebrow-green">Kind 0</span>
                <h2>Profile basics</h2>
              </div>
              <p class="muted">This becomes your public author card across the app.</p>
            </div>

            <div class="onboarding-fields">
              <label class="field">
                <span class="muted">Name</span>
                <input bind:value={name} oninput={noteProfileEdit} placeholder="fiatjaf" />
              </label>

              <label class="field">
                <span class="muted">Display name</span>
                <input bind:value={display} oninput={noteProfileEdit} placeholder="fiatjaf.com" />
              </label>

              <label class="field">
                <span class="muted">Bio</span>
                <textarea
                  bind:value={about}
                  oninput={noteProfileEdit}
                  placeholder="Write a short note about what you publish."
                ></textarea>
              </label>

              <label class="field">
                <span class="muted">Website</span>
                <input
                  bind:value={website}
                  oninput={noteProfileEdit}
                  placeholder="https://example.com"
                />
              </label>
            </div>
          </article>

          <article class="panel onboarding-card">
            <div class="onboarding-card-header">
              <div>
                <span class="eyebrow eyebrow-yellow">Blossom</span>
                <h2>Profile picture</h2>
              </div>
              <p class="muted">Upload an avatar now, or leave the slot empty and add one later.</p>
            </div>

            <div class="onboarding-avatar-row">
              <div class="onboarding-avatar-preview">
                {#if avatarDisplayUrl}
                  <img src={avatarDisplayUrl} alt={`${writerLabel} avatar preview`} />
                {:else}
                  <span>{writerLabel.slice(0, 1).toUpperCase()}</span>
                {/if}
              </div>

              <div class="stack">
                <label class="field">
                  <span class="muted">Blossom server</span>
                  <input
                    bind:value={blossomServer}
                    oninput={noteBlossomEdit}
                    placeholder={DEFAULT_BLOSSOM_SERVER}
                  />
                </label>

                <label class="field">
                  <span class="muted">Picture file</span>
                  <input bind:this={fileInput} type="file" accept="image/*" onchange={handleAvatarSelection} />
                </label>

                <div class="helper-row">
                  <button
                    class="button-secondary"
                    type="button"
                    onclick={() => void uploadAvatarFile()}
                    disabled={!avatarFile || uploadingAvatar}
                  >
                    {uploadingAvatar ? 'Uploading...' : avatarUrl ? 'Replace picture' : 'Upload picture'}
                  </button>

                  {#if avatarDisplayUrl}
                    <button class="button-secondary" type="button" onclick={removeAvatar}>
                      Remove picture
                    </button>
                  {/if}
                </div>

                {#if uploadProgress !== null}
                  <p class="caption onboarding-progress">Upload progress: {uploadProgress}%</p>
                {/if}
                {#if uploadError}
                  <p class="error" style="margin: 0;">{uploadError}</p>
                {/if}
              </div>
            </div>
          </article>

          <article class="panel onboarding-card">
            <div class="onboarding-card-header">
              <div>
                <span class="eyebrow eyebrow-red">NIP-51</span>
                <h2>Interests</h2>
              </div>
              <p class="muted">Choose the subjects you want this reader profile to signal.</p>
            </div>

            <div class="interest-grid">
              {#each INTEREST_SUGGESTIONS as interest}
                <button
                  class:active={selectedInterests.includes(interest)}
                  class="interest-chip"
                  type="button"
                  onclick={() => toggleInterest(interest)}
                >
                  {interest}
                </button>
              {/each}
            </div>

            <div class="onboarding-custom-interest">
              <label class="field">
                <span class="muted">Add your own</span>
                <input
                  bind:value={customInterest}
                  placeholder="long-form"
                  onkeydown={handleCustomInterestKeydown}
                />
              </label>
              <button class="button-secondary" type="button" onclick={addCustomInterest}>
                Add interest
              </button>
            </div>

            {#if normalizedInterests.length > 0}
              <div class="topic-row">
                {#each normalizedInterests as interest}
                  <button class="status-pill status-blue interest-pill" type="button" onclick={() => removeInterest(interest)}>
                    #{interest}
                  </button>
                {/each}
              </div>
            {/if}
          </article>

          <div class="helper-row onboarding-actions">
            <button class="button" type="submit" disabled={!canSubmit}>
              {saving ? 'Publishing...' : 'Publish profile'}
            </button>
            <a class="button-secondary" href="/">Back to reading</a>
          </div>

          {#if saveError}
            <p class="error" style="margin: 0;">{saveError}</p>
          {/if}
          {#if saveMessage}
            <p class="caption" style="margin: 0;">{saveMessage}</p>
          {/if}
        </form>

        <aside class="onboarding-sidebar">
          <article class="panel onboarding-card onboarding-checklist">
            <span class="eyebrow eyebrow-blue">Checklist</span>
            <h2>What gets published</h2>
            <ul>
              <li class:done={Boolean(cleanText(name) || cleanText(display))}>
                A kind:0 profile with your name, bio, website, and avatar URL
              </li>
              <li class:done={Boolean(avatarUrl || avatarFile)}>
                A picture uploaded to Blossom with `{DEFAULT_BLOSSOM_SERVER}` as the default server
              </li>
              <li class:done={normalizedInterests.length > 0}>
                A NIP-51 interest list event with your selected topics
              </li>
            </ul>
          </article>

          <article class="panel onboarding-card onboarding-preview">
            <span class="eyebrow eyebrow-green">Preview</span>
            <div class="onboarding-preview-head">
              <div class="onboarding-avatar-preview onboarding-avatar-preview-small">
                {#if avatarDisplayUrl}
                  <img src={avatarDisplayUrl} alt="" />
                {:else}
                  <span>{writerLabel.slice(0, 1).toUpperCase()}</span>
                {/if}
              </div>

              <div class="stack tight">
                <strong>{writerLabel}</strong>
                {#if cleanText(website)}
                  <span class="muted">{cleanText(website)}</span>
                {:else if profileLoading}
                  <span class="muted">Loading existing profile...</span>
                {:else}
                  <span class="muted">No website yet</span>
                {/if}
              </div>
            </div>

            <p class="muted" style="margin: 0;">
              {cleanText(about) || 'Your bio will appear here once you add one.'}
            </p>

            {#if normalizedInterests.length > 0}
              <div class="topic-row">
                {#each normalizedInterests.slice(0, 6) as interest}
                  <span class="status-pill status-yellow">#{interest}</span>
                {/each}
              </div>
            {/if}

            <div class="definition-list compact">
              <div class="definition-row">
                <span>Profile route</span>
                <strong>
                  /profile/{profileIdentifier(
                    {
                      ...(resolvedProfile ?? {}),
                      name: cleanText(name) || undefined,
                      displayName: cleanText(display) || undefined
                    },
                    currentUser.npub
                  )}
                </strong>
              </div>
              <div class="definition-row">
                <span>Blossom</span>
                <strong>{parseBlossomServer(blossomServer) ?? DEFAULT_BLOSSOM_SERVER}</strong>
              </div>
            </div>
          </article>
        </aside>
      </div>
    </div>
  </section>
{/if}
