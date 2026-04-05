<script lang="ts">
  import type { PageProps } from './$types';
  import { NDKEvent } from '@nostr-dev-kit/ndk';
  import ArticleMarkdown from '$lib/components/ArticleMarkdown.svelte';
  import { User } from '$lib/ndk/ui/user';
  import { reveal } from '$lib/actions/reveal';
  import {
    articlePublishedAt,
    articleReadTimeMinutes,
    articleSummary,
    articleTitle,
    articleTopics,
    cleanText,
    displayName,
    formatDisplayDate,
    noteExcerpt,
    noteTitle
  } from '$lib/ndk/format';
  import { ndk } from '$lib/ndk/client';

  let { data }: PageProps = $props();

  const event = $derived(data.event ? new NDKEvent(ndk, data.event) : undefined);
  const isArticle = $derived(event?.kind === 30023);
  const authorName = $derived(displayName(data.profile, 'Author'));
  const authorIdentity = $derived.by(() => {
    const nip05 = cleanText(data.profile?.nip05);
    return nip05 && nip05 !== authorName ? nip05 : '';
  });
</script>

{#if data.missing}
  <section class="section reveal" use:reveal>
    <article class="panel stack">
      <span class="eyebrow eyebrow-red">Missing note</span>
      <h1>This post is not available right now</h1>
      <p class="muted" style="margin: 0;">It may have moved, been deleted, or not synced yet.</p>
    </article>
  </section>
{:else if event}
  <section class="section bento">
    <article class="panel span-12 reveal" use:reveal>
      <span class="eyebrow eyebrow-blue">{isArticle ? 'Article' : 'Note'}</span>
      <h1>{isArticle ? articleTitle(event.rawEvent()) : noteTitle(event.rawEvent())}</h1>

      <div class="article-byline">
        <User.Root {ndk} pubkey={data.authorPubkey} profile={data.profile}>
          <a class="article-author-link" href={`/profile/${data.authorIdentifier}`}>
            <User.Avatar class="article-author-avatar" />
          </a>
          <div class="article-author-copy">
            <div class="feed-meta">
              <a class="article-author-name" href={`/profile/${data.authorIdentifier}`}>{authorName}</a>
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
            {#if authorIdentity}
              <div class="feed-meta">
                <span class="article-author-handle">{authorIdentity}</span>
              </div>
            {/if}
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
        <pre class="document-copy">{event.content}</pre>
      {/if}
    </article>
  </section>
{/if}
