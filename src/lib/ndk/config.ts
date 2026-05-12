export const APP_NAME = 'Open Prompt';
export const APP_TAGLINE =
  'The source code of AI-built software — browse the human prompts that built real products.';

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
