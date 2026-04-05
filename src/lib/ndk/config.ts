export const APP_NAME = 'Relay Press';
export const APP_TAGLINE =
  'Long-form Nostr reading with SSR, browser login, and preview-safe metadata.';

const FALLBACK_RELAYS = [
  'wss://relay.damus.io',
  'wss://purplepag.es',
  'wss://relay.primal.net'
];

export const DEFAULT_RELAYS = parseRelayList(
  import.meta.env.PUBLIC_NOSTR_RELAYS as string | undefined,
  FALLBACK_RELAYS
);

function parseRelayList(value: string | undefined, fallback: string[]): string[] {
  if (!value) return fallback;

  const parsed = value
    .split(',')
    .map((relay) => relay.trim())
    .filter(Boolean);

  return parsed.length > 0 ? parsed : fallback;
}
