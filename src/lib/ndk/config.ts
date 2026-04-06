export const APP_NAME = 'Highlighter';
export const APP_TAGLINE =
  'A calm place to read and share long-form writing from Nostr.';

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
