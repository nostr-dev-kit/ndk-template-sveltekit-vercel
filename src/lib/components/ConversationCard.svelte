<script lang="ts">
  import type { NDKEvent } from '@nostr-dev-kit/ndk';
  import { relativeTime, type TenexConversationMeta } from '$lib/ndk/tenex';

  interface Props {
    rootEvent: NDKEvent;
    metadata?: TenexConversationMeta;
  }

  let { rootEvent, metadata }: Props = $props();

  function sanitizePrompt(value: string): string {
    let out = '';
    for (let i = 0; i < value.length; i++) {
      const code = value.charCodeAt(i);
      if (code === 10 || code === 9) {
        out += value[i];
      } else if (code < 32 || code === 127) {
        continue;
      } else {
        out += value[i];
      }
    }
    return out.replace(/\n{3,}/g, '\n\n').trim();
  }

  const promptText = $derived(sanitizePrompt(rootEvent.content ?? ''));

  const displayTitle = $derived.by(() => {
    const title = metadata?.title;
    if (!title || title === 'Untitled conversation') return undefined;
    return title;
  });

  const timestamp = $derived(metadata?.updatedAt ?? rootEvent.created_at ?? 0);

  const statusVariant = $derived.by(() => {
    const label = metadata?.statusLabel?.toLowerCase() ?? '';
    if (!label) return '';
    if (label.includes('progress') || label.includes('active') || label.includes('working')) {
      return 'in-progress';
    }
    if (label.includes('complete') || label.includes('done') || label.includes('shipped')) {
      return 'complete';
    }
    if (label.includes('block') || label.includes('fail') || label.includes('error')) {
      return 'blocked';
    }
    return 'neutral';
  });
</script>

<a class="conversation-card" href={`/c/${rootEvent.id}`}>
  {#if promptText}
    <p class="conversation-card-prompt">{promptText}</p>
  {:else}
    <p class="conversation-card-prompt conversation-card-prompt-empty">
      (no message content)
    </p>
  {/if}

  <div class="conversation-card-meta">
    {#if displayTitle}
      <span class="conversation-card-title">{displayTitle}</span>
    {/if}
    {#if metadata?.statusLabel}
      <span class="conversation-status-badge {statusVariant}">{metadata.statusLabel}</span>
    {/if}
    {#if metadata?.statusActivity}
      <span class="conversation-status-activity">{metadata.statusActivity}</span>
    {/if}
    <span class="conversation-card-time">{relativeTime(timestamp)}</span>
  </div>
</a>

<style>
  .conversation-card {
    display: grid;
    gap: 0.75rem;
    padding: 1.4rem 0;
    border-bottom: 1px solid var(--border-light);
    color: inherit;
    text-decoration: none;
  }

  .conversation-card:first-child {
    border-top: 1px solid var(--border-light);
  }

  .conversation-card:hover .conversation-card-prompt {
    color: var(--accent);
  }

  .conversation-card-prompt {
    margin: 0;
    font-family: var(--font-serif);
    font-size: 1.15rem;
    font-weight: 500;
    line-height: 1.45;
    color: var(--text-strong);
    white-space: pre-wrap;
    transition: color 160ms ease;
    display: -webkit-box;
    -webkit-line-clamp: 4;
    line-clamp: 4;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .conversation-card-prompt-empty {
    color: var(--muted);
    font-style: italic;
  }

  .conversation-card-meta {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.55rem;
    font-size: 0.78rem;
    color: var(--muted);
  }

  .conversation-card-title {
    font-weight: 600;
    color: var(--text);
  }

  .conversation-card-time {
    margin-left: auto;
    flex-shrink: 0;
  }

  .conversation-status-badge {
    display: inline-flex;
    align-items: center;
    padding: 0.18rem 0.55rem;
    border-radius: 9999px;
    background: var(--pale-yellow);
    color: var(--pale-yellow-text);
    font-weight: 600;
    letter-spacing: 0.02em;
  }

  .conversation-status-badge.in-progress {
    background: var(--pale-blue);
    color: var(--pale-blue-text);
  }

  .conversation-status-badge.complete {
    background: var(--pale-green);
    color: var(--pale-green-text);
  }

  .conversation-status-badge.blocked {
    background: var(--pale-red);
    color: var(--pale-red-text);
  }

  .conversation-status-activity {
    color: var(--muted);
    font-style: italic;
  }
</style>
