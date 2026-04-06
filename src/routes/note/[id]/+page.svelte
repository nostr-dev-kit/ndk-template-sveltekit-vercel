<script lang="ts">
  import type { PageProps } from './$types';
  import { page } from '$app/state';
  import { browser } from '$app/environment';
  import { createFetchEvent, createFetchUser } from '@nostr-dev-kit/svelte';
  import { NDKEvent, type NDKFilter, type NostrEvent } from '@nostr-dev-kit/ndk';
  import ArticleMarkdown from '$lib/components/ArticleMarkdown.svelte';
  import * as Tabs from '$lib/components/ui/tabs';
  import { User } from '$lib/ndk/ui/user';
  import { reveal } from '$lib/actions/reveal';
  import {
    articlePublishedAt,
    articleReadTimeMinutes,
    articleSummary,
    articleTitle,
    displayNip05,
    displayName,
    formatDisplayDate,
    noteExcerpt,
    noteTitle,
    profileIdentifier
  } from '$lib/ndk/format';
  import { ndk } from '$lib/ndk/client';

  let { data }: PageProps = $props();
  let activeTab = $state<'article' | 'comments' | 'highlights'>('article');

  const routeIdentifier = $derived(page.params.id || '');
  const seedEvent = $derived(data.event ? new NDKEvent(ndk, data.event) : undefined);
  const fetchedEvent = createFetchEvent(ndk, () => ({
    bech32: routeIdentifier,
    opts: { closeOnEose: true }
  }));
  const event = $derived(fetchedEvent.event ?? seedEvent);
  const isArticle = $derived(event?.kind === 30023);
  const authorPubkey = $derived(event?.pubkey ?? data.authorPubkey ?? '');
  const author = createFetchUser(ndk, () => authorPubkey || data.authorNpub || '');
  const authorProfile = $derived(author.profile ?? data.profile);
  const authorLinkIdentifier = $derived(
    profileIdentifier(authorProfile, author.npub || data.authorNpub || authorPubkey || 'author')
  );
  const seedComments = $derived(
    (data.comments ?? []).map((comment: NostrEvent) => new NDKEvent(ndk, comment))
  );
  const seedHighlights = $derived(
    (data.highlights ?? []).map((highlight: NostrEvent) => new NDKEvent(ndk, highlight))
  );
  const liveComments = ndk.$subscribe(() => {
    if (!browser || !event || event.kind !== 30023) return undefined;

    const filters = buildReferenceFilters(targetReferences(event), [1111], {
      addressTag: 'A',
      idTag: 'E',
      limit: 120
    });

    return filters.length > 0 ? { filters } : undefined;
  });
  const liveHighlights = ndk.$subscribe(() => {
    if (!browser || !event || event.kind !== 30023) return undefined;

    const filters = buildReferenceFilters(targetReferences(event), [9802], {
      addressTag: 'a',
      idTag: 'e',
      limit: 80
    });

    return filters.length > 0 ? { filters } : undefined;
  });
  const commentEvents = $derived(
    mergeUniqueEvents(
      liveComments.events.filter((comment) => comment.kind === 1111),
      seedComments
    )
  );
  const highlightEvents = $derived(
    mergeUniqueEvents(
      liveHighlights.events.filter((highlight) => highlight.kind === 9802),
      seedHighlights
    )
  );
  const missing = $derived(!event && (browser ? !fetchedEvent.loading : data.missing));
  const authorName = $derived(displayName(authorProfile, authorPubkey ? `${authorPubkey.slice(0, 8)}...` : 'Author'));
  const authorIdentity = $derived.by(() => {
    const nip05 = displayNip05(authorProfile);
    return nip05 && nip05 !== authorName ? nip05 : '';
  });
  const articleAddress = $derived(isArticle && event ? event.tagId() : '');
  const articleEventId = $derived(event?.id ?? '');
  const commentCount = $derived(commentEvents.length);
  const highlightCount = $derived(highlightEvents.length);

  type CommentNode = {
    event: NDKEvent;
    children: CommentNode[];
  };

  const commentTree = $derived.by(() => {
    const rootReferences = new Set([articleAddress, articleEventId].filter(Boolean));
    const nodes = commentEvents.map((comment) => ({
      event: comment,
      parentReference: commentParentReference(comment),
      children: [] as CommentNode[]
    }));
    const nodesByReference = new Map<string, CommentNode>();

    for (const node of nodes) {
      nodesByReference.set(node.event.id, node);
      nodesByReference.set(node.event.tagId(), node);
    }

    const roots: CommentNode[] = [];

    for (const node of nodes) {
      if (!node.parentReference || rootReferences.has(node.parentReference)) {
        roots.push(node);
        continue;
      }

      const parent = nodesByReference.get(node.parentReference);
      if (!parent || parent === node) {
        roots.push(node);
        continue;
      }

      parent.children.push(node);
    }

    return sortCommentNodes(roots, 'desc');
  });

  function tagValue(tags: string[][], name: string): string {
    return tags.find((tag) => tag[0] === name)?.[1]?.trim() ?? '';
  }

  function commentParentReference(comment: NDKEvent): string {
    return tagValue(comment.tags, 'a') || tagValue(comment.tags, 'e') || tagValue(comment.tags, 'i');
  }

  function sortCommentNodes(nodes: CommentNode[], direction: 'asc' | 'desc'): CommentNode[] {
    const sorted = [...nodes].sort((left, right) =>
      direction === 'asc'
        ? (left.event.created_at ?? 0) - (right.event.created_at ?? 0)
        : (right.event.created_at ?? 0) - (left.event.created_at ?? 0)
    );

    for (const node of sorted) {
      node.children = sortCommentNodes(node.children, 'asc');
    }

    return sorted;
  }

  function targetReferences(target: NDKEvent): Set<string> {
    const references = new Set<string>();
    const tagId = target.tagId();

    if (tagId) references.add(tagId);
    if (target.id) references.add(target.id);

    return references;
  }

  function buildReferenceFilters(
    references: Set<string>,
    kinds: number[],
    options: {
      addressTag: string;
      idTag: string;
      limit: number;
    }
  ): NDKFilter[] {
    const ids: string[] = [];
    const addresses: string[] = [];

    for (const reference of references) {
      if (reference.includes(':')) addresses.push(reference);
      else ids.push(reference);
    }

    const filters: NDKFilter[] = [];

    if (addresses.length > 0) {
      const filter = { kinds, limit: options.limit } as NDKFilter & Record<`#${string}`, string[]>;
      filter[`#${options.addressTag}`] = addresses;
      filters.push(filter);
    }

    if (ids.length > 0) {
      const filter = { kinds, limit: options.limit } as NDKFilter & Record<`#${string}`, string[]>;
      filter[`#${options.idTag}`] = ids;
      filters.push(filter);
    }

    return filters;
  }

  function mergeUniqueEvents(primary: NDKEvent[], secondary: NDKEvent[]): NDKEvent[] {
    const merged: NDKEvent[] = [];
    const seen = new Set<string>();

    for (const event of [...primary, ...secondary]) {
      const key = event.id || event.tagId();
      if (!key || seen.has(key)) continue;

      seen.add(key);
      merged.push(event);
    }

    return merged;
  }
</script>

{#if missing}
  <section class="section reveal" use:reveal>
    <article class="panel stack">
      <h1>{browser && fetchedEvent.loading ? 'Loading this post...' : 'This post is not available right now'}</h1>
      <p class="muted" style="margin: 0;">
        {browser && fetchedEvent.loading
          ? 'Trying to load it directly from relays.'
          : 'It may have moved, been deleted, or not synced yet.'}
      </p>
    </article>
  </section>
{:else if event}
  <section class="section bento">
    <article class="panel span-12 reveal" use:reveal>
      <h1>{isArticle ? articleTitle(event.rawEvent()) : noteTitle(event.rawEvent())}</h1>

      <div class="article-byline">
        <User.Root {ndk} pubkey={authorPubkey} profile={authorProfile}>
          <a class="article-author-link" href={`/profile/${authorLinkIdentifier}`}>
            <User.Avatar class="article-author-avatar" />
          </a>
          <div class="article-author-copy">
            <div class="feed-meta">
              <a class="article-author-name" href={`/profile/${authorLinkIdentifier}`}>{authorName}</a>
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
        <Tabs.Root bind:value={activeTab} activationMode="manual">
          <Tabs.List class="article-tabs-list" aria-label="Article views">
            <Tabs.Trigger value="article">Article</Tabs.Trigger>
            <Tabs.Trigger value="comments">
              <span>Comments</span>
              <span class="article-tab-count">{commentCount}</span>
            </Tabs.Trigger>
            <Tabs.Trigger value="highlights">
              <span>Highlights</span>
              <span class="article-tab-count">{highlightCount}</span>
            </Tabs.Trigger>
          </Tabs.List>

          <Tabs.Content value="article" class="article-tab-panel">
            <ArticleMarkdown content={event.content} tags={event.tags} />
          </Tabs.Content>

          <Tabs.Content value="comments" class="article-tab-panel">
            {#if commentTree.length > 0}
              <div class="comment-thread">
                {#snippet renderComments(nodes: CommentNode[], depth = 0)}
                  {#each nodes as node (node.event.id)}
                    <article class="comment-card" style={`--comment-depth: ${Math.min(depth, 6)};`}>
                      <div class="comment-meta">
                        <User.Root {ndk} pubkey={node.event.pubkey}>
                          <a class="comment-author-link" href={`/profile/${node.event.pubkey}`}>
                            <User.Avatar class="article-author-avatar article-author-avatar-compact" />
                          </a>
                          <div class="comment-author-copy">
                            <div class="feed-meta">
                              <a class="article-author-name" href={`/profile/${node.event.pubkey}`}>
                                <User.Name fallback="Commenter" />
                              </a>
                              <span>
                                {node.event.created_at
                                  ? new Date(node.event.created_at * 1000).toLocaleString()
                                  : 'Undated'}
                              </span>
                            </div>
                          </div>
                        </User.Root>
                      </div>

                      <p class="comment-body">{node.event.content}</p>

                      {#if node.children.length > 0}
                        <div class="comment-children">
                          {@render renderComments(node.children, depth + 1)}
                        </div>
                      {/if}
                    </article>
                  {/each}
                {/snippet}

                {@render renderComments(commentTree)}
              </div>
            {/if}
          </Tabs.Content>

          <Tabs.Content value="highlights" class="article-tab-panel">
            {#if highlightEvents.length > 0}
              <div class="highlight-stack">
                {#each highlightEvents as highlight (highlight.id)}
                  <article class="highlight-card">
                    <div class="comment-meta">
                      <User.Root {ndk} pubkey={highlight.pubkey}>
                        <a class="comment-author-link" href={`/profile/${highlight.pubkey}`}>
                          <User.Avatar class="article-author-avatar article-author-avatar-compact" />
                        </a>
                        <div class="comment-author-copy">
                          <div class="feed-meta">
                            <a class="article-author-name" href={`/profile/${highlight.pubkey}`}>
                              <User.Name fallback="Reader" />
                            </a>
                            <span>
                              {highlight.created_at
                                ? new Date(highlight.created_at * 1000).toLocaleString()
                                : 'Undated'}
                            </span>
                          </div>
                        </div>
                      </User.Root>
                    </div>

                    <blockquote class="highlight-quote">
                      {highlight.content || 'This highlight has no text excerpt.'}
                    </blockquote>

                    {#if tagValue(highlight.tags, 'comment')}
                      <p class="highlight-note">{tagValue(highlight.tags, 'comment')}</p>
                    {/if}

                    {#if tagValue(highlight.tags, 'context')}
                      <p class="caption" style="margin: 0;">Context: {tagValue(highlight.tags, 'context')}</p>
                  {/if}
                </article>
              {/each}
              </div>
            {/if}
          </Tabs.Content>
        </Tabs.Root>
      {:else}
        <pre class="document-copy">{event.content}</pre>
      {/if}
    </article>
  </section>
{/if}
