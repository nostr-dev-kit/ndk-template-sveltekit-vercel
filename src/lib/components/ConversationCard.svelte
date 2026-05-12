<script lang="ts">
  import { relativeTime, type TenexConversationMeta } from '$lib/ndk/tenex';

  interface Props {
    conversation: TenexConversationMeta;
  }

  let { conversation }: Props = $props();

  const statusVariant = $derived.by(() => {
    const label = conversation.statusLabel?.toLowerCase() ?? '';
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

<a class="conversation-card" href={`/c/${conversation.rootId}`}>
  <div class="conversation-card-head">
    <h3 class="conversation-card-title">{conversation.title}</h3>
    <span class="conversation-card-time">{relativeTime(conversation.updatedAt)}</span>
  </div>

  {#if conversation.summary}
    <p class="conversation-card-summary">{conversation.summary}</p>
  {/if}

  {#if conversation.statusLabel || conversation.statusActivity}
    <div class="conversation-card-status">
      {#if conversation.statusLabel}
        <span class="conversation-status-badge {statusVariant}">{conversation.statusLabel}</span>
      {/if}
      {#if conversation.statusActivity}
        <span class="conversation-status-activity">{conversation.statusActivity}</span>
      {/if}
    </div>
  {/if}
</a>

<style>
  .conversation-card {
    display: grid;
    gap: 0.6rem;
    padding: 1.1rem 0;
    border-bottom: 1px solid var(--border-light);
    color: inherit;
    text-decoration: none;
    transition: transform 160ms ease;
  }

  .conversation-card:first-child {
    border-top: 1px solid var(--border-light);
  }

  .conversation-card:hover .conversation-card-title {
    color: var(--accent);
  }

  .conversation-card-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 1rem;
  }

  .conversation-card-title {
    margin: 0;
    font-family: var(--font-serif);
    font-size: 1.2rem;
    font-weight: 700;
    color: var(--text-strong);
    line-height: 1.25;
    transition: color 160ms ease;
  }

  .conversation-card-time {
    flex-shrink: 0;
    font-size: 0.78rem;
    color: var(--muted);
  }

  .conversation-card-summary {
    margin: 0;
    color: var(--muted);
    font-size: 0.93rem;
    line-height: 1.55;
  }

  .conversation-card-status {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.55rem;
    font-size: 0.78rem;
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
