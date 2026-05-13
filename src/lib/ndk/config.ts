export const APP_NAME = 'Open Prompt';

const FALLBACK_RELAYS = [
  'wss://relay.tenex.chat',
  'wss://relay.primal.net',
  'wss://relay.damus.io',
  'wss://purplepag.es',
  'wss://nos.lol',
  'wss://relay.nostr.band'
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
