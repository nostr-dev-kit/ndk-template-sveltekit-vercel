<script lang="ts">
  import { browser } from '$app/environment';
  import type { PageProps } from './$types';
  import { ndk } from '$lib/ndk/client';
  import { User } from '$lib/ndk/ui/user';
  import AgentRoster from '$lib/components/AgentRoster.svelte';
  import ConversationCard from '$lib/components/ConversationCard.svelte';
  import {
    KIND_CONVERSATION_METADATA,
    KIND_MESSAGE,
    parseConversationMetadata
  } from '$lib/ndk/tenex';

  let { data }: PageProps = $props();

  const project = $derived(data.project);

  const conversationDiscovery = ndk.$subscribe(() => {
    if (!browser || !project) return undefined;
    return {
      filters: [
        { kinds: [KIND_CONVERSATION_METADATA as number], '#a': [project.address], limit: 100 },
        {
          kinds: [KIND_MESSAGE],
          '#a': [project.address],
          authors: [project.pubkey],
          limit: 100
        }
      ]
    };
  });

  const conversations = $derived.by(() => {
    const lastSeen = new Map<string, number>();
    for (const event of conversationDiscovery.events) {
      let rootId: string | undefined;
      let ts = event.created_at ?? 0;
      if (event.kind === KIND_CONVERSATION_METADATA) {
        const meta = parseConversationMetadata(event);
        if (!meta) continue;
        rootId = meta.rootId;
        ts = meta.updatedAt;
      } else if (event.kind === KIND_MESSAGE && event.id) {
        rootId = event.id;
      }
      if (!rootId) continue;
      const existing = lastSeen.get(rootId) ?? 0;
      if (ts > existing) lastSeen.set(rootId, ts);
    }
    return Array.from(lastSeen.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([rootId]) => rootId);
  });
</script>

{#if data.missing || !project}
  <section class="project-missing">
    <span class="eyebrow eyebrow-blue">Project</span>
    <h1>This project is not available.</h1>
    <p class="muted">It may have moved, been deleted, or not synced yet.</p>
    <a class="project-missing-link" href="/projects">← Back to all projects</a>
  </section>
{:else}
  <article class="project-page">
    <header class="project-header">
      <span class="eyebrow eyebrow-blue">Project</span>
      <h1 class="project-title">{project.title}</h1>

      <User.Root {ndk} pubkey={project.pubkey}>
        <a class="project-owner" href={`/profile/${project.pubkey}`}>
          <User.Avatar class="project-owner-avatar" />
          <span class="project-owner-name">
            <User.Name fallback={`${project.pubkey.slice(0, 8)}…`} />
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
          {browser ? 'Looking for conversations…' : 'No conversations found.'}
        </p>
      {:else}
        <div class="conversation-list">
          {#each conversations as rootId (rootId)}
            <ConversationCard {rootId} expectedAuthor={project.pubkey} />
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
    justify-items: start;
  }

  .project-missing-link {
    margin-top: 0.5rem;
    color: var(--accent);
    font-weight: 500;
  }

  .project-missing-link:hover {
    color: var(--accent-hover);
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
