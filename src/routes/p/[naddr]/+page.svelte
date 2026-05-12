<script lang="ts">
  import { browser } from '$app/environment';
  import type { PageProps } from './$types';
  import { ndk } from '$lib/ndk/client';
  import { User } from '$lib/ndk/ui/user';
  import { displayName } from '$lib/ndk/format';
  import AgentRoster from '$lib/components/AgentRoster.svelte';
  import ConversationCard from '$lib/components/ConversationCard.svelte';
  import {
    KIND_CONVERSATION_METADATA,
    parseConversationMetadata,
    type TenexConversationMeta
  } from '$lib/ndk/tenex';

  let { data }: PageProps = $props();

  const project = $derived(data.project);
  const ownerProfile = $derived(project ? data.profiles?.[project.pubkey] : undefined);

  const liveConversations = ndk.$subscribe(() => {
    if (!browser || !project) return undefined;
    return {
      filters: [
        { kinds: [KIND_CONVERSATION_METADATA as number], '#a': [project.address], limit: 100 }
      ]
    };
  });

  const conversations = $derived.by<TenexConversationMeta[]>(() => {
    const byRoot = new Map<string, TenexConversationMeta>();

    for (const seed of data.conversations ?? []) {
      byRoot.set(seed.rootId, seed);
    }

    for (const event of liveConversations.events) {
      const meta = parseConversationMetadata(event);
      if (!meta) continue;
      const existing = byRoot.get(meta.rootId);
      if (!existing || meta.updatedAt > existing.updatedAt) {
        byRoot.set(meta.rootId, meta);
      }
    }

    return Array.from(byRoot.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  });
</script>

{#if data.missing || !project}
  <section class="project-missing">
    <span class="eyebrow eyebrow-blue">Project</span>
    <h1>This project is not available.</h1>
    <p class="muted">It may have moved, been deleted, or not synced yet.</p>
  </section>
{:else}
  <article class="project-page">
    <header class="project-header">
      <span class="eyebrow eyebrow-blue">Project</span>
      <h1 class="project-title">{project.title}</h1>

      <User.Root {ndk} pubkey={project.pubkey} profile={ownerProfile}>
        <a class="project-owner" href={`/profile/${project.pubkey}`}>
          <User.Avatar class="project-owner-avatar" />
          <span class="project-owner-name">
            {displayName(ownerProfile, `${project.pubkey.slice(0, 8)}…`)}
          </span>
        </a>
      </User.Root>

      {#if project.description}
        <p class="project-description">{project.description}</p>
      {/if}
    </header>

    <AgentRoster agents={project.agents} models={project.models} />

    <section class="project-conversations">
      <h2 class="section-title">
        Conversations
        <span class="section-count">{conversations.length}</span>
      </h2>

      {#if conversations.length === 0}
        <p class="muted">
          {browser ? 'No conversations yet for this project.' : 'No conversations found.'}
        </p>
      {:else}
        <div class="conversation-list">
          {#each conversations as conversation (conversation.rootId)}
            <ConversationCard {conversation} />
          {/each}
        </div>
      {/if}
    </section>
  </article>
{/if}

<style>
  .project-page {
    max-width: var(--content-width);
    margin: 0 auto;
    display: grid;
    gap: 2.5rem;
  }

  .project-missing {
    max-width: var(--content-width);
    margin: 0 auto;
    display: grid;
    gap: 0.75rem;
  }

  .project-header {
    display: grid;
    gap: 1rem;
  }

  .project-title {
    margin: 0;
    font-family: var(--font-serif);
    font-size: clamp(2rem, 4vw, 2.8rem);
    font-weight: 700;
    line-height: 1.1;
    letter-spacing: -0.02em;
    color: var(--text-strong);
  }

  .project-owner {
    display: inline-flex;
    align-items: center;
    gap: 0.55rem;
    color: var(--text);
    width: max-content;
  }

  .project-owner:hover .project-owner-name {
    color: var(--accent);
  }

  :global(.project-owner-avatar) {
    width: 2rem !important;
    height: 2rem !important;
    border-radius: 9999px;
  }

  .project-owner-name {
    font-weight: 500;
    transition: color 160ms ease;
  }

  .project-description {
    margin: 0;
    color: var(--text);
    font-size: 1rem;
    line-height: 1.65;
    white-space: pre-wrap;
  }

  .section-title {
    margin: 0 0 1rem;
    font-family: var(--font-serif);
    font-size: 1.3rem;
    font-weight: 700;
    color: var(--text-strong);
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }

  .section-count {
    display: inline-flex;
    align-items: center;
    padding: 0.1rem 0.55rem;
    border-radius: 9999px;
    background: var(--surface-soft);
    color: var(--muted);
    font-family: var(--font-sans);
    font-size: 0.75rem;
    font-weight: 600;
  }

  .conversation-list {
    display: grid;
  }
</style>
