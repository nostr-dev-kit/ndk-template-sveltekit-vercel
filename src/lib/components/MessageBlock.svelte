<script lang="ts">
  import type { NDKEvent } from '@nostr-dev-kit/ndk';
  import { ndk } from '$lib/ndk/client';
  import { User } from '$lib/ndk/ui/user';
  import { MarkdownEventContent } from '$lib/ndk/ui/markdown-event-content';
  import { displayName } from '$lib/ndk/format';
  import { relativeTime, type TenexAgent } from '$lib/ndk/tenex';

  interface Props {
    event: NDKEvent;
    agent?: TenexAgent;
  }

  let { event, agent }: Props = $props();

  const isAgent = $derived(Boolean(agent));
  let expanded = $state(false);
  let bodyEl = $state<HTMLDivElement | null>(null);
  let overflow = $state(false);

  $effect(() => {
    expanded = !isAgent;
  });

  $effect(() => {
    if (!isAgent) {
      overflow = false;
      return;
    }
    if (!bodyEl) return;
    queueMicrotask(() => {
      if (!bodyEl) return;
      overflow = bodyEl.scrollHeight - bodyEl.clientHeight > 4;
    });
  });

  const roleLabel = $derived.by(() => {
    if (!agent) return 'Human';
    return agent.slug ?? '';
  });
</script>

<article class="message-block" class:message-agent={isAgent} class:message-human={!isAgent}>
  <header class="message-header">
    <User.Root {ndk} pubkey={event.pubkey}>
      <a class="message-author-link" href={`/profile/${event.pubkey}`}>
        <User.Avatar class="message-avatar" />
      </a>
      <div class="message-meta">
        <a class="message-author-name" href={`/profile/${event.pubkey}`}>
          <User.Name fallback={isAgent ? agent?.slug ?? 'Agent' : 'Human'} />
        </a>
        <div class="message-meta-row">
          <span class="message-role" class:role-agent={isAgent} class:role-human={!isAgent}>
            {#if !isAgent}
              <span aria-hidden="true">🧑 </span>Human
            {:else if roleLabel}
              {roleLabel}
            {:else}
              Agent
            {/if}
          </span>
          {#if agent?.role}
            <span class="message-role-detail">{agent.role}</span>
          {/if}
          <span class="message-timestamp">{relativeTime(event.created_at)}</span>
        </div>
      </div>
    </User.Root>
  </header>

  <div
    bind:this={bodyEl}
    class="message-body"
    class:message-body-collapsed={isAgent && !expanded}
  >
    <MarkdownEventContent
      {ndk}
      content={event.content}
      emojiTags={event.tags}
      class="message-markdown"
    />
  </div>

  {#if isAgent && (overflow || expanded)}
    <button class="message-toggle" onclick={() => (expanded = !expanded)}>
      {expanded ? 'Show less' : 'Show more'}
    </button>
  {/if}
</article>

<style>
  .message-block {
    display: grid;
    gap: 1rem;
    padding: 1.75rem 0;
    border-bottom: 1px solid var(--border-light);
  }

  .message-block:first-child {
    border-top: 1px solid var(--border-light);
  }

  .message-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .message-author-link {
    flex-shrink: 0;
  }

  :global(.message-avatar) {
    width: 2.25rem !important;
    height: 2.25rem !important;
    border-radius: 9999px;
  }

  .message-meta {
    display: grid;
    gap: 0.15rem;
    min-width: 0;
  }

  .message-author-name {
    font-weight: 600;
    color: var(--text-strong);
    font-size: 0.95rem;
  }

  .message-author-name:hover {
    color: var(--accent);
  }

  .message-meta-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.55rem;
    font-size: 0.78rem;
    color: var(--muted);
  }

  .message-role {
    display: inline-flex;
    align-items: center;
    padding: 0.1rem 0.5rem;
    border-radius: 9999px;
    font-weight: 600;
    letter-spacing: 0.02em;
    text-transform: lowercase;
  }

  .message-role.role-human {
    background: hsl(220, 80%, 95%);
    color: var(--accent);
    text-transform: none;
  }

  .message-role.role-agent {
    background: var(--surface-soft);
    color: var(--muted);
    font-family: var(--font-mono);
  }

  .message-role-detail {
    color: var(--muted);
  }

  .message-timestamp {
    color: var(--muted);
  }

  /* ── HUMAN message — "the source code" ─────────────────────── */
  .message-human {
    padding: 2.5rem 0;
  }

  .message-human .message-body :global(.message-markdown) {
    font-family: var(--font-serif);
    font-size: 1.18rem;
    line-height: 1.75;
    color: var(--text-strong);
  }

  .message-human .message-body :global(.message-markdown p) {
    margin: 0 0 1rem;
  }

  .message-human .message-body :global(.message-markdown p:last-child) {
    margin-bottom: 0;
  }

  .message-human .message-body :global(.message-markdown pre),
  .message-human .message-body :global(.message-markdown code) {
    font-family: var(--font-mono);
  }

  /* ── AGENT message — "build output" ────────────────────────── */
  .message-agent {
    padding: 1.25rem 0;
  }

  .message-agent .message-body :global(.message-markdown) {
    font-family: var(--font-sans);
    font-size: 0.92rem;
    line-height: 1.6;
    color: var(--text);
    background: var(--surface-soft);
    border-left: 2px solid var(--border);
    padding: 0.9rem 1.1rem;
    border-radius: var(--radius-sm);
    overflow-wrap: anywhere;
  }

  .message-agent .message-body :global(.message-markdown p) {
    margin: 0 0 0.55rem;
  }

  .message-agent .message-body :global(.message-markdown p:last-child) {
    margin-bottom: 0;
  }

  .message-agent .message-body :global(.message-markdown pre) {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 0.65rem 0.85rem;
    font-size: 0.82rem;
    overflow-x: auto;
  }

  .message-body-collapsed {
    max-height: 6.5rem;
    overflow: hidden;
    position: relative;
  }

  .message-body-collapsed::after {
    content: '';
    position: absolute;
    inset: auto 0 0 0;
    height: 3rem;
    background: linear-gradient(to bottom, transparent, var(--canvas));
    pointer-events: none;
  }

  .message-toggle {
    justify-self: start;
    background: none;
    border: none;
    padding: 0;
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--muted);
    cursor: pointer;
    letter-spacing: 0.02em;
    transition: color 120ms ease;
  }

  .message-toggle:hover {
    color: var(--accent);
  }
</style>
