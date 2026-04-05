# SvelteKit + NDK Template

This template is a minimal Svelte 5 + `@nostr-dev-kit/svelte` project that is designed around the same separation that makes Wikifreedia's SSR work reliably:

- browser interactivity uses `NDKSvelte`
- `+page.server.ts` loads use plain `NDK`
- route metadata is generated on the server for Open Graph and Twitter previews
- login is included with NIP-07 and private-key flows
- registry-backed UI primitives are wired through jsrepo with `@ndk/svelte`
- deployment targets Vercel via `@sveltejs/adapter-vercel`

## Why the split matters

`NDKSvelte` is the right tool for client subscriptions, live feeds, and session-aware UI. It is not the right thing to depend on for social crawlers. Crawlers only see the HTML returned by the server, so preview-critical routes need to fetch their own Nostr data in `+page.server.ts` and emit SEO tags there.

This template makes that explicit instead of hiding it behind one cross-environment singleton.

## Registry integration

The starter now behaves like a real `@ndk/svelte` jsrepo consumer:

- `jsrepo.config.ts` points at `@ndk/svelte`
- registry-installed code lives under `src/lib/ndk/*`
- the root layout seeds the shared NDK instance into context for registry components
- the homepage, profile page, and note/article page already render author UI through the registry-backed `ui/user` primitive

To add more registry items into the same structure:

```bash
bunx jsrepo add ui/user
bunx jsrepo add components/session-switcher
```

## Routes

- `/` shows a publication-style front page seeded with long-form articles
- `/profile/[identifier]` SSR-fetches an author profile and recent articles
- `/note/[id]` SSR-fetches an article or note and author metadata

Both SSR routes return `seo` data that the root layout renders through `SeoHead.svelte`.

## Local development

```bash
bun install
bun run dev
```

## Environment

Set relays with:

```bash
PUBLIC_NOSTR_RELAYS=wss://relay.damus.io,wss://purplepag.es,wss://relay.primal.net
```

If omitted, the template uses those three relays by default.

## Deploying to Vercel

1. Import the project into Vercel.
2. Leave the framework preset on `SvelteKit`.
3. Add `PUBLIC_NOSTR_RELAYS` if you want custom relays.
4. Deploy.

No custom `vercel.json` is required for the base template.

## File map

- `src/lib/ndk/client.ts`: browser `NDKSvelte` instance with session persistence
- `src/lib/ndk/ui/`: registry-installed UI primitives from `@ndk/svelte`
- `src/lib/ndk/builders/`: registry-installed builders used by those primitives
- `src/lib/ndk/utils/ndk/`: the NDK context helper expected by registry items
- `src/lib/server/nostr.ts`: server-only `NDK` helpers for SSR loads
- `src/lib/seo.ts`: preview metadata builders
- `src/lib/components/SeoHead.svelte`: canonical, OG, and Twitter tags
- `jsrepo.config.ts`: consumer config for adding more registry items with jsrepo

## Social preview note

This template ships with a stable default OG image in `static/og-default.png` plus route-specific
titles and descriptions. If you want fully dynamic per-note images, layer that on top of the same
SSR metadata flow rather than moving preview generation into client code.
