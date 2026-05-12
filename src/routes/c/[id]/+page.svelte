<script lang="ts">
  import { page } from '$app/state';

  const id = $derived(page.params.id);
</script>

<section class="placeholder">
  <span class="eyebrow eyebrow-blue">Conversation</span>
  <h1>Conversation thread.</h1>
  <p class="lede">
    The full message thread will render here — human prompts visually primary, agent replies
    secondary.
  </p>
  <p class="caption">Placeholder for <code class="mono-inline">{id}</code>.</p>
</section>

<style>
  .placeholder {
    max-width: var(--content-width);
    margin: 0 auto;
    display: grid;
    gap: 1rem;
  }
</style>
