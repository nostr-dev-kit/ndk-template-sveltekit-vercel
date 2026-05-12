<script lang="ts">
  import { browser } from '$app/environment';
  import type { PageProps } from './$types';
  import { ndk } from '$lib/ndk/client';
  import ProjectCard from '$lib/components/ProjectCard.svelte';
  import { KIND_PROJECT, parseProjectEvent, type TenexProject } from '$lib/ndk/tenex';

  let { data }: PageProps = $props();

  const liveProjects = ndk.$subscribe(() => {
    if (!browser) return undefined;
    return {
      filters: [{ kinds: [KIND_PROJECT], limit: 80 }]
    };
  });

  const projects = $derived.by<TenexProject[]>(() => {
    const byAddress = new Map<string, TenexProject>();

    for (const seed of data.projects) {
      byAddress.set(seed.address, seed);
    }

    for (const event of liveProjects.events) {
      const project = parseProjectEvent(event);
      if (!project) continue;
      const existing = byAddress.get(project.address);
      if (!existing || project.createdAt > existing.createdAt) {
        byAddress.set(project.address, project);
      }
    }

    return Array.from(byAddress.values()).sort((a, b) => b.createdAt - a.createdAt);
  });
</script>

<section class="projects-page">
  <header class="projects-header">
    <span class="eyebrow eyebrow-blue">Projects</span>
    <h1>Browse projects.</h1>
    <p class="lede">
      TENEX projects shipping real products. Each one surfaces the conversations behind it — the
      prompts that produced the code.
    </p>
  </header>

  {#if projects.length === 0}
    <p class="muted">
      {browser ? 'Looking for projects on the network…' : 'No projects available right now.'}
    </p>
  {:else}
    <div class="projects-grid">
      {#each projects as project (project.address)}
        <ProjectCard {project} ownerProfile={data.profiles?.[project.pubkey]} />
      {/each}
    </div>
  {/if}
</section>

<style>
  .projects-page {
    max-width: var(--page-width);
    margin: 0 auto;
    display: grid;
    gap: 2.5rem;
  }

  .projects-header {
    max-width: var(--content-width);
    display: grid;
    gap: 0.75rem;
  }

  .projects-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1rem;
  }
</style>
