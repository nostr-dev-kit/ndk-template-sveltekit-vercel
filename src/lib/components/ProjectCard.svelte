<script lang="ts">
  import { ndk } from '$lib/ndk/client';
  import { User } from '$lib/ndk/ui/user';
  import type { TenexProject } from '$lib/ndk/tenex';

  interface Props {
    project: TenexProject;
  }

  let { project }: Props = $props();

  const agentCount = $derived(project.agents.length);
  const ownerFallback = $derived(`${project.pubkey.slice(0, 8)}…`);
</script>

<a class="project-card" href={`/p/${project.naddr}`}>
  <div class="project-card-head">
    <h3 class="project-card-title">{project.title}</h3>
    {#if project.description}
      <p class="project-card-description">{project.description}</p>
    {/if}
  </div>

  <div class="project-card-meta">
    <User.Root {ndk} pubkey={project.pubkey}>
      <span class="project-card-owner">
        <User.Avatar class="project-card-avatar" />
        <span class="project-card-owner-name">
          <User.Name fallback={ownerFallback} />
        </span>
      </span>
    </User.Root>
    <span class="project-card-agents">
      {agentCount}
      {agentCount === 1 ? 'agent' : 'agents'}
    </span>
  </div>
</a>

<style>
  .project-card {
    display: grid;
    gap: 1rem;
    padding: 1.25rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--surface);
    color: inherit;
    text-decoration: none;
    transition:
      border-color 160ms ease,
      transform 160ms ease,
      box-shadow 160ms ease;
  }

  .project-card:hover {
    border-color: var(--accent);
    transform: translateY(-1px);
    box-shadow: 0 4px 18px rgba(0, 0, 0, 0.04);
  }

  .project-card-head {
    display: grid;
    gap: 0.5rem;
  }

  .project-card-title {
    margin: 0;
    font-family: var(--font-serif);
    font-size: 1.35rem;
    font-weight: 700;
    letter-spacing: -0.01em;
    color: var(--text-strong);
    line-height: 1.2;
  }

  .project-card-description {
    margin: 0;
    color: var(--muted);
    font-size: 0.93rem;
    line-height: 1.5;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .project-card-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    font-size: 0.85rem;
    color: var(--muted);
  }

  .project-card-owner {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }

  :global(.project-card-avatar) {
    width: 1.5rem !important;
    height: 1.5rem !important;
    border-radius: 9999px;
  }

  .project-card-owner-name {
    color: var(--text);
    font-weight: 500;
  }

  .project-card-agents {
    display: inline-flex;
    align-items: center;
    padding: 0.2rem 0.65rem;
    border-radius: 9999px;
    background: var(--pale-blue);
    color: var(--pale-blue-text);
    font-size: 0.78rem;
    font-weight: 600;
  }
</style>
