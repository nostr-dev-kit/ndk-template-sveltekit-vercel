<script lang="ts">
  import { ndk } from '$lib/ndk/client';
  import { User } from '$lib/ndk/ui/user';
  import type { TenexAgent, TenexModel } from '$lib/ndk/tenex';

  interface Props {
    agents: TenexAgent[];
    models: TenexModel[];
  }

  let { agents, models }: Props = $props();

  function modelForSlug(slug: string): string | undefined {
    return models.find((model) => model.assignedAgentSlug === slug)?.name;
  }
</script>

{#if agents.length > 0}
  <section class="agent-roster">
    <h2 class="agent-roster-title">
      Agent team <span class="agent-roster-count">{agents.length}</span>
    </h2>
    <div class="agent-roster-grid">
      {#each agents as agent (agent.pubkey)}
        <div class="agent-card">
          <User.Root {ndk} pubkey={agent.pubkey}>
            <User.Avatar class="agent-card-avatar" />
            <div class="agent-card-body">
              <span class="agent-card-slug">{agent.slug}</span>
              {#if agent.role}
                <span class="agent-card-role">{agent.role}</span>
              {/if}
              {#if modelForSlug(agent.slug)}
                <span class="agent-card-model">{modelForSlug(agent.slug)}</span>
              {/if}
            </div>
          </User.Root>
        </div>
      {/each}
    </div>
  </section>
{/if}

<style>
  .agent-roster {
    display: grid;
    gap: 1rem;
  }

  .agent-roster-title {
    margin: 0;
    font-family: var(--font-serif);
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--text-strong);
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }

  .agent-roster-count {
    display: inline-flex;
    align-items: center;
    padding: 0.1rem 0.55rem;
    border-radius: 9999px;
    background: var(--pale-blue);
    color: var(--pale-blue-text);
    font-family: var(--font-sans);
    font-size: 0.75rem;
    font-weight: 600;
  }

  .agent-roster-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 0.75rem;
  }

  .agent-card {
    display: flex;
    align-items: center;
    gap: 0.65rem;
    padding: 0.65rem 0.85rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--surface);
  }

  :global(.agent-card-avatar) {
    width: 2rem !important;
    height: 2rem !important;
    border-radius: 9999px;
    flex-shrink: 0;
  }

  .agent-card-body {
    display: grid;
    gap: 0.1rem;
    min-width: 0;
  }

  .agent-card-slug {
    font-family: var(--font-mono);
    font-size: 0.82rem;
    color: var(--text-strong);
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .agent-card-role {
    font-size: 0.75rem;
    color: var(--muted);
  }

  .agent-card-model {
    font-size: 0.72rem;
    color: var(--accent);
    font-family: var(--font-mono);
  }
</style>
