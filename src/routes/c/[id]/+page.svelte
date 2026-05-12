<script lang="ts">
  import { browser } from '$app/environment';
  import type { PageProps } from './$types';
  import { NDKEvent, type NostrEvent } from '@nostr-dev-kit/ndk';
  import { ndk } from '$lib/ndk/client';
  import MessageBlock from '$lib/components/MessageBlock.svelte';
  import { mergeUniqueEvents } from '$lib/ndk/events';
  import {
    KIND_CONVERSATION_METADATA,
    KIND_MESSAGE,
    findAgent,
    parseConversationMetadata,
    relativeTime,
    sortMessagesChronologically
  } from '$lib/ndk/tenex';

  let { data }: PageProps = $props();

  const rootId = $derived(data.rootId);
  const seedRoot = $derived(data.root ? new NDKEvent(ndk, data.root) : undefined);
  const seedMessages = $derived(
    (data.messages ?? []).map((raw: NostrEvent) => new NDKEvent(ndk, raw))
  );

  const liveMessages = ndk.$subscribe(() => {
    if (!browser || !rootId) return undefined;
    return {
      filters: [{ ids: [rootId] }, { kinds: [KIND_MESSAGE], '#e': [rootId], limit: 500 }]
    };
  });

  const liveMetadata = ndk.$subscribe(() => {
    if (!browser || !rootId) return undefined;
    return {
      filters: [{ kinds: [KIND_CONVERSATION_METADATA as number], '#e': [rootId], limit: 10 }]
    };
  });

  const meta = $derived.by(() => {
    let latest = data.meta;

    for (const event of liveMetadata.events) {
      const candidate = parseConversationMetadata(event);
      if (!candidate) continue;
      if (!latest || candidate.updatedAt > latest.updatedAt) {
        latest = candidate;
      }
    }

    return latest;
  });

  const project = $derived(data.project);

  const allMessages = $derived.by(() => {
    const merged = mergeUniqueEvents(
      liveMessages.events.filter(
        (event) => event.kind === KIND_MESSAGE && (event.id === rootId || hasRootETag(event, rootId))
      ),
      seedMessages
    );
    return sortMessagesChronologically(
      merged.length > 0 ? merged : seedRoot ? [seedRoot] : merged
    );
  });

  function hasRootETag(event: NDKEvent, id: string): boolean {
    return event.tags.some((tag) => tag[0] === 'e' && tag[1] === id);
  }

  const conversationTitle = $derived(meta?.title || 'Conversation');
  const missing = $derived(data.missing && allMessages.length === 0 && !meta);
  const loading = $derived(!missing && allMessages.length === 0);
</script>

{#if missing}
  <section class="conversation-missing">
    <span class="eyebrow eyebrow-blue">Conversation</span>
    <h1>This conversation is not available.</h1>
    <p class="muted">It may have moved, been deleted, or not synced yet.</p>
    <a class="conversation-missing-link" href="/projects">← Browse all projects</a>
  </section>
{:else}
  <article class="conversation-page">
    <header class="conversation-header">
      <span class="eyebrow eyebrow-blue">
        {#if project}
          <a href={`/p/${project.naddr}`} class="conversation-project-link">{project.title}</a>
        {:else}
          Conversation
        {/if}
      </span>
      <h1 class="conversation-title">{conversationTitle}</h1>

      {#if meta?.summary}
        <p class="lede">{meta.summary}</p>
      {/if}

      <div class="conversation-meta">
        {#if meta?.statusLabel}
          <span class="conversation-status">{meta.statusLabel}</span>
        {/if}
        {#if meta?.statusActivity}
          <span class="conversation-activity">{meta.statusActivity}</span>
        {/if}
        {#if meta?.updatedAt}
          <span class="conversation-updated">Updated {relativeTime(meta.updatedAt)}</span>
        {/if}
      </div>
    </header>

    <section class="conversation-thread">
      {#if loading}
        <p class="conversation-loading muted">Loading messages…</p>
      {:else}
        {#each allMessages as event (event.id)}
          <MessageBlock {event} agent={project ? findAgent(event.pubkey, project.agents) : undefined} />
        {/each}
      {/if}
    </section>
  </article>
{/if}

<style>
  .conversation-page {
    max-width: var(--content-width);
    margin: 0 auto;
    display: grid;
    gap: 2.5rem;
  }

  .conversation-missing {
    max-width: var(--content-width);
    margin: 0 auto;
    display: grid;
    gap: 0.75rem;
    justify-items: start;
  }

  .conversation-missing-link {
    margin-top: 0.5rem;
    color: var(--accent);
    font-weight: 500;
  }

  .conversation-missing-link:hover {
    color: var(--accent-hover);
  }

  .conversation-header {
    display: grid;
    gap: 1rem;
  }

  .conversation-project-link {
    color: inherit;
  }

  .conversation-project-link:hover {
    color: var(--accent);
  }

  .conversation-title {
    margin: 0;
    font-family: var(--font-serif);
    font-size: clamp(2.1rem, 4.5vw, 3.1rem);
    font-weight: 700;
    line-height: 1.1;
    letter-spacing: -0.02em;
    color: var(--text-strong);
  }

  .conversation-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.6rem;
    font-size: 0.82rem;
    color: var(--muted);
  }

  .conversation-status {
    display: inline-flex;
    padding: 0.18rem 0.65rem;
    border-radius: 9999px;
    background: var(--pale-blue);
    color: var(--pale-blue-text);
    font-weight: 600;
  }

  .conversation-activity {
    font-style: italic;
  }

  .conversation-thread {
    display: grid;
  }

  .conversation-loading {
    padding: 1.5rem 0;
  }
</style>
