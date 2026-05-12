import type { NDKEvent } from '@nostr-dev-kit/ndk';
import { KIND_PROJECT, parseProjectEvent, type TenexProject } from './tenex';

export function mergeProjects(seeds: TenexProject[], liveEvents: NDKEvent[]): TenexProject[] {
  const byAddress = new Map<string, TenexProject>();

  for (const seed of seeds) {
    byAddress.set(seed.address, seed);
  }

  for (const event of liveEvents) {
    const tags = event.tags ?? [];
    const dTag = tags.find((tag) => tag[0] === 'd')?.[1];
    if (!dTag || !event.pubkey) continue;
    const address = `${KIND_PROJECT}:${event.pubkey}:${dTag}`;
    const eventCreatedAt = event.created_at ?? 0;
    const existing = byAddress.get(address);
    const isDeleted = tags.some((tag) => tag[0] === 'deleted');

    if (isDeleted) {
      if (existing && eventCreatedAt >= existing.createdAt) {
        byAddress.delete(address);
      }
      continue;
    }

    if (existing && eventCreatedAt <= existing.createdAt) continue;
    const project = parseProjectEvent(event);
    if (!project) continue;
    byAddress.set(project.address, project);
  }

  return Array.from(byAddress.values()).sort((a, b) => b.createdAt - a.createdAt);
}
