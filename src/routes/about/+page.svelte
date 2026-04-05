<script lang="ts">
  import { reveal } from '$lib/actions/reveal';
</script>

<section class="hero section reveal" use:reveal>
  <span class="eyebrow eyebrow-green">About the template</span>
  <h1>A SvelteKit starter for long-form Nostr apps that need the first request to work.</h1>
  <p class="lede">
    Most Nostr demos stop at subscriptions. This template starts where article products usually get
    hard: shareable routes, server-rendered previews, browser login, and a deployment path you can
    put on Vercel without rebuilding the app boundary later.
  </p>
  <div class="actions">
    <a class="button" href="/">Open the demo</a>
    <a
      class="button-secondary"
      href="https://github.com/nostr-dev-kit/ndk/tree/master/svelte/templates/sveltekit-vercel-ndk"
      target="_blank"
      rel="noopener noreferrer"
    >
      Use the template
    </a>
  </div>
  <p class="caption">
    Built for teams that want long-form article pages, author pages, and social previews to behave
    like proper documents instead of placeholders waiting for hydration.
  </p>
</section>

<section class="section bento">
  <article class="panel span-8 reveal" use:reveal>
    <div class="panel-header">
      <span class="eyebrow eyebrow-blue">Why it exists</span>
      <h2>Long-form Nostr apps feel broken when everything waits for the browser.</h2>
      <p class="muted">
        A client-only prototype can look fine in a local tab and fail the moment someone shares an
        article link. Social unfurlers, crawlers, and first-time readers do not wait for session
        state, IndexedDB, or client subscriptions.
      </p>
    </div>

    <div class="definition-list">
      <div class="definition-row">
        <span>Problem</span>
        <p>Client-first Nostr demos usually ship blank previews and weak first loads for article pages.</p>
      </div>
      <div class="definition-row">
        <span>Approach</span>
        <p>This template resolves article and profile data on the server before hydration starts.</p>
      </div>
      <div class="definition-row">
        <span>Result</span>
        <p>Article routes, author routes, and social cards behave like actual documents.</p>
      </div>
    </div>
  </article>

  <article class="panel span-4 reveal" style="--index: 1;" use:reveal>
    <span class="eyebrow eyebrow-yellow">Specific proof</span>
    <h3>Concrete pieces, not broad promises.</h3>
    <div class="definition-list">
      <div class="definition-row">
        <span>3 surfaces</span>
        <p>A server-seeded home page, author pages, and article pages.</p>
      </div>
      <div class="definition-row">
        <span>2 logins</span>
        <p>NIP-07 extension login and private-key login in the header.</p>
      </div>
      <div class="definition-row">
        <span>1 deploy path</span>
        <p>Vercel adapter included with no extra routing config.</p>
      </div>
    </div>
  </article>
</section>

<section class="section bento">
  <article class="panel span-4 reveal" use:reveal>
    <span class="eyebrow eyebrow-green">What you get</span>
    <h3>An article app shape that already understands Nostr.</h3>
    <p class="muted" style="margin: 0;">
      The template splits browser and server work cleanly instead of hiding both behind one global
      instance.
    </p>
  </article>

  <article class="panel span-4 reveal" style="--index: 1;" use:reveal>
    <span class="eyebrow eyebrow-blue">Preview safety</span>
    <h3>Canonical, Open Graph, and Twitter metadata ship with the route.</h3>
    <p class="muted" style="margin: 0;">
      Shared article links render with a title, description, and fallback image before the client
      connects.
    </p>
  </article>

  <article class="panel span-4 reveal" style="--index: 2;" use:reveal>
    <span class="eyebrow eyebrow-red">Browser sessions</span>
    <h3>Login stays where it belongs: in the browser.</h3>
    <p class="muted" style="margin: 0;">
      `ndk.$sessions` handles persistence locally while server loads stay deterministic.
    </p>
  </article>
</section>

<section class="section bento">
  <article class="panel span-7 reveal" use:reveal>
    <div class="panel-header">
      <span class="eyebrow eyebrow-blue">How it works</span>
      <h2>The template separates the three jobs that usually get tangled together.</h2>
    </div>

    <div class="window">
      <div class="window-chrome">
        <span class="window-controls" aria-hidden="true">
          <span class="window-dot"></span>
          <span class="window-dot"></span>
          <span class="window-dot"></span>
        </span>
        <span>Starter map</span>
        <kbd>3 layers</kbd>
      </div>

      <div class="window-body">
        <div class="definition-list">
          <div class="definition-row">
            <span>Client</span>
            <p><span class="mono-inline">client.ts</span> initializes `NDKSvelte`, sessions, and live subscriptions.</p>
          </div>
          <div class="definition-row">
            <span>Server</span>
            <p><span class="mono-inline">nostr.ts</span> uses plain `NDK` for `+page.server.ts` fetches.</p>
          </div>
          <div class="definition-row">
            <span>SEO</span>
            <p><span class="mono-inline">seo.ts</span> turns route data into metadata for crawlers and previews.</p>
          </div>
          <div class="definition-row">
            <span>Registry</span>
            <p><span class="mono-inline">jsrepo.config.ts</span> points at <kbd>@ndk/svelte</kbd>, and installed registry code lives under <span class="mono-inline">src/lib/ndk/*</span>.</p>
          </div>
        </div>
      </div>
    </div>
  </article>

  <article class="panel span-5 reveal" style="--index: 1;" use:reveal>
    <span class="eyebrow eyebrow-yellow">Who it is for</span>
    <h3>Use this when article routes need to feel finished from day one.</h3>
    <div class="definition-list">
      <div class="definition-row">
        <span>Publishers</span>
        <p>Who want a Nostr-native reading product instead of a note demo.</p>
      </div>
      <div class="definition-row">
        <span>Teams</span>
        <p>Who need author pages and article routes that hold up in previews.</p>
      </div>
      <div class="definition-row">
        <span>Maintainers</span>
        <p>Who need a clear starting point for Vercel deployment.</p>
      </div>
    </div>
  </article>
</section>

<section class="section reveal" style="--index: 2;" use:reveal>
  <article class="panel soft stack">
    <span class="eyebrow eyebrow-green">Use it</span>
    <h2>Start from a template that already handles the uncomfortable parts of long-form Nostr.</h2>
    <p class="lede" style="margin: 0;">
      If you know your app needs shareable article routes, login, and deployment discipline, begin
      here instead of rebuilding the boundary between client and server after the product is live.
    </p>
    <div class="actions">
      <a class="button" href="/">Review the demo</a>
      <a
        class="button-secondary"
        href="https://github.com/nostr-dev-kit/ndk/tree/master/svelte/templates/sveltekit-vercel-ndk"
        target="_blank"
        rel="noopener noreferrer"
      >
        Open the template folder
      </a>
    </div>
  </article>
</section>
