<script lang="ts">
  import type { PageProps } from './$types';

  let { }: PageProps = $props();
</script>

<section class="landing">
  <div class="landing-hero">
    <span class="eyebrow eyebrow-blue">Open Prompt</span>
    <h1 class="landing-title">View source for the age of AI-built software.</h1>
    <p class="lede">
      The source code of AI-built software is the human prompt. Open Prompt is a read-only browser
      for the conversations behind real products — the messages that shipped the code.
    </p>
    <div class="actions">
      <a class="button" href="/projects">Browse projects</a>
      <a class="button-link" href="/about">What is this?</a>
    </div>
  </div>
</section>

<style>
  .landing {
    max-width: var(--content-width);
    margin: 0 auto;
    display: grid;
    gap: 2rem;
  }

  .landing-hero {
    display: grid;
    gap: 1.25rem;
  }

  .landing-title {
    margin: 0;
    font-family: var(--font-serif);
    font-size: clamp(2.2rem, 5vw, 3.6rem);
    font-weight: 700;
    line-height: 1.05;
    letter-spacing: -0.02em;
    color: var(--text-strong);
  }
</style>
