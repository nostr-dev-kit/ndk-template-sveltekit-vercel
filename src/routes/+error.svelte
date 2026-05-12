<script lang="ts">
  import { page } from '$app/state';

  const status = $derived(page.status);
  const message = $derived(page.error?.message ?? '');
  const heading = $derived(status === 404 ? 'Page not found.' : 'Something went wrong.');
  const detail = $derived(
    status === 404
      ? "We couldn't find what you were looking for."
      : message || 'An unexpected error occurred.'
  );
</script>

<svelte:head>
  <title>{status} — Open Prompt</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<section class="error-page">
  <span class="eyebrow eyebrow-blue">{status}</span>
  <h1>{heading}</h1>
  <p class="muted">{detail}</p>
  <a class="error-link" href="/projects">← Browse all projects</a>
</section>

<style>
  .error-page {
    max-width: var(--content-width);
    margin: 4rem auto;
    display: grid;
    gap: 0.75rem;
    justify-items: start;
  }

  .error-page h1 {
    margin: 0;
    font-family: var(--font-serif);
    font-size: clamp(2rem, 4vw, 2.6rem);
    font-weight: 700;
    color: var(--text-strong);
    letter-spacing: -0.02em;
  }

  .error-link {
    margin-top: 0.5rem;
    color: var(--accent);
    font-weight: 500;
  }

  .error-link:hover {
    color: var(--accent-hover);
  }
</style>
