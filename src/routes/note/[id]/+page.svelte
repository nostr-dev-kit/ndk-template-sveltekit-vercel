<script lang="ts">
  import type { PageProps } from './$types';
  import { NDKEvent, type NostrEvent } from '@nostr-dev-kit/ndk';
  import ArticleMarkdown from '$lib/components/ArticleMarkdown.svelte';
  import { User } from '$lib/ndk/ui/user';
  import { reveal } from '$lib/actions/reveal';
  import {
    articlePublishedAt,
    articleReadTimeMinutes,
    articleSummary,
    articleTitle,
    articleTopics,
    displayName,
    formatDisplayDate,
    noteExcerpt,
    noteTitle,
    shortPubkey
  } from '$lib/ndk/format';
  import { ndk } from '$lib/ndk/client';

  let { data }: PageProps = $props();

  const event = $derived(data.event ? new NDKEvent(ndk, data.event) : undefined);
  const authorName = $derived(
    data.authorPubkey ? displayName(data.profile, shortPubkey(data.authorPubkey)) : 'Unknown author'
  );
  const isArticle = $derived(event?.kind === 30023);
</script>

{#if data.missing}
  <section class="section reveal" use:reveal>
    <article class="panel stack">
      <span class="eyebrow eyebrow-red">Missing note</span>
      <h1>This note could not be loaded</h1>
      <p class="muted" style="margin: 0;">
        Verify that the note exists on one of the configured relays or switch to a different relay
        set through <kbd>PUBLIC_NOSTR_RELAYS</kbd>.
      </p>
    </article>
  </section>
{:else if event}
  <section class="section bento">
    <article class="panel span-8 reveal" use:reveal>
      <span class="eyebrow eyebrow-blue">{isArticle ? 'Server article' : 'Server note'}</span>
      <h1>{isArticle ? articleTitle(event.rawEvent()) : noteTitle(event.rawEvent())}</h1>

      <div class="article-byline">
        <User.Root {ndk} pubkey={data.authorPubkey} profile={data.profile}>
          <a class="article-author-link" href={`/profile/${data.authorNpub}`}>
            <User.Avatar class="article-author-avatar" />
          </a>
          <div class="article-author-copy">
            <div class="feed-meta">
              <a class="article-author-name" href={`/profile/${data.authorNpub}`}>
                <User.Name />
              </a>
              <span>
                {#if isArticle}
                  {formatDisplayDate(articlePublishedAt(event.rawEvent()))}
                {:else if event.created_at}
                  {new Date(event.created_at * 1000).toLocaleString()}
                {/if}
              </span>
              {#if isArticle}
                <span>{articleReadTimeMinutes(event.content)} min read</span>
              {/if}
            </div>
            <div class="feed-meta">
              <User.Handle class="article-author-handle" showAt={false} />
              <span class="mono-inline">{shortPubkey(data.authorPubkey ?? '')}</span>
            </div>
          </div>
        </User.Root>
      </div>

      <p class="lede" style="margin: 0;">
        {isArticle ? articleSummary(event.rawEvent(), 320) : noteExcerpt(event.content, 320)}
      </p>

      {#if isArticle}
        <div class="topic-row">
          {#each articleTopics(event.rawEvent()) as topic}
            <span class="status-pill status-yellow">{topic}</span>
          {/each}
        </div>
      {/if}

      {#if isArticle}
        <ArticleMarkdown content={event.content} tags={event.tags} />
      {:else}
        <div class="window">
          <div class="window-chrome">
            <span class="window-controls" aria-hidden="true">
              <span class="window-dot"></span>
              <span class="window-dot"></span>
              <span class="window-dot"></span>
            </span>
            <span>Raw note content</span>
            <kbd>kind {event.kind}</kbd>
          </div>
          <div class="window-body">
            <pre class="document-pre">{event.content}</pre>
          </div>
        </div>
      {/if}
    </article>

    <aside class="panel span-4 reveal" style="--index: 1;" use:reveal>
      <span class="eyebrow eyebrow-green">Share surface</span>
      <h3>The metadata for this {isArticle ? 'article' : 'note'} is computed before the client loads.</h3>
      <div class="definition-list">
        <div class="definition-row">
          <span>Author</span>
          <p>{authorName}</p>
        </div>
        <div class="definition-row">
          <span>Route</span>
          <p>Designed for unfurlers, crawlers, and direct links first.</p>
        </div>
        <div class="definition-row">
          <span>Image</span>
          <p>Uses the fallback social image until you add per-article image rendering.</p>
        </div>
        {#if isArticle}
          <div class="definition-row">
            <span>Renderer</span>
            <p>Markdown and Nostr references render through the registry-style content renderer.</p>
          </div>
        {/if}
      </div>
    </aside>
  </section>
{/if}
