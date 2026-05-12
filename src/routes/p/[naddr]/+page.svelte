<script lang="ts">
  import { page } from '$app/state';

  const naddr = $derived(page.params.naddr);
</script>

<section class="placeholder">
  <span class="eyebrow eyebrow-blue">Project</span>
  <h1>Project detail.</h1>
  <p class="lede">
    The conversations belonging to this project will surface here — every thread that helped ship
    the product.
  </p>
  <p class="caption">Placeholder for <code class="mono-inline">{naddr}</code>.</p>
</section>

<style>
  .placeholder {
    max-width: var(--content-width);
    margin: 0 auto;
    display: grid;
    gap: 1rem;
  }
</style>
