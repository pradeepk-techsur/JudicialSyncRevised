import { ANTHROPIC_KEY_PATTERN } from '@/lib/constants';

// Provider/model/temperature config for the Pivota Assistant (F7).
// SERVER-SIDE ONLY — never import from a client component. The API key is read
// from process.env here and nowhere else; it must never appear in the client
// bundle or a NEXT_PUBLIC_ variable (TechArch 06-integrations.md §7.1).

// Pinned Claude Sonnet id (TechArch: "Claude Sonnet (latest)"). Overridable via
// ANTHROPIC_MODEL env for a recorded-demo swap without a code change.
const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-4-5';

export const ANTHROPIC_MODEL: string =
  process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_ANTHROPIC_MODEL;

// Temperature 0 for BOTH tool-selection and answer composition — determinism is
// a release blocker for live/recorded demos (CONTEXT.md Decisions).
export const ASSISTANT_TEMPERATURE = 0 as const;

// The placeholder string shipped in .env.example. A key equal to this (or empty)
// counts as "not configured" so a developer who merely copied .env.example does
// not get cryptic 401s from Anthropic — they get the clean 503 unavailable path.
const PLACEHOLDER_KEY = 'sk-ant-REPLACE_ME';

export function getAnthropicApiKey(): string | undefined {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key || key === PLACEHOLDER_KEY) return undefined;
  return key;
}

// True only when a real, non-placeholder key is present. The chat route calls
// this FIRST and returns 503 ASSISTANT_UNAVAILABLE when false — the app still
// boots and every other screen works (ROADMAP criterion 5).
export function isAssistantConfigured(): boolean {
  return getAnthropicApiKey() !== undefined;
}

// -----------------------------------------------------------------------------
// Bring-your-own-key (BYOK). A user may paste their own Anthropic key in the
// assistant UI; it is kept in their browser and sent per request in the
// ASSISTANT_API_KEY_HEADER header. The server uses it for that one request and
// never persists or logs it. A request key takes precedence over the server's
// ANTHROPIC_API_KEY, so a deployment with no server key still has a working
// assistant for anyone who brings one — without putting a shared key behind an
// unauthenticated URL.
// -----------------------------------------------------------------------------

/** A browser-supplied key, trimmed, if it is shaped like a real Anthropic key;
 *  otherwise undefined (including the .env.example placeholder). */
export function normalizeUserApiKey(raw: string | null | undefined): string | undefined {
  const key = raw?.trim();
  if (!key || key === PLACEHOLDER_KEY || !ANTHROPIC_KEY_PATTERN.test(key)) return undefined;
  return key;
}

export type ResolvedAnthropicKey =
  | { ok: true; apiKey: string; source: 'request' | 'server' }
  | { ok: false; reason: 'rejected' | 'missing' };

/**
 * Pick the key for one chat request. A request that carries the BYOK header is
 * judged on that key alone — a malformed one is rejected rather than silently
 * falling back to the server key, so the user learns their key is wrong. With no
 * header, the server key (if any) is used.
 */
export function resolveAnthropicApiKey(requestKey: string | null | undefined): ResolvedAnthropicKey {
  if (requestKey != null && requestKey.trim() !== '') {
    const apiKey = normalizeUserApiKey(requestKey);
    return apiKey ? { ok: true, apiKey, source: 'request' } : { ok: false, reason: 'rejected' };
  }
  const serverKey = getAnthropicApiKey();
  return serverKey ? { ok: true, apiKey: serverKey, source: 'server' } : { ok: false, reason: 'missing' };
}

/**
 * The fixed error CODE a mid-stream failure is reported as. Never the raw
 * provider error (which could echo config). An authentication failure from the
 * provider is the one case worth distinguishing: with BYOK it means "your key is
 * wrong", which retrying cannot fix.
 */
export function assistantStreamErrorCode(error: unknown): 'ASSISTANT_KEY_REJECTED' | 'ASSISTANT_UNAVAILABLE' {
  const status = providerStatusCode(error);
  return status === 401 || status === 403 ? 'ASSISTANT_KEY_REJECTED' : 'ASSISTANT_UNAVAILABLE';
}

/** statusCode of an APICallError, looking through a RetryError's lastError.
 *  Read structurally so this module stays free of SDK class identity checks. */
function providerStatusCode(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const e = error as { statusCode?: unknown; lastError?: unknown };
  if (typeof e.statusCode === 'number') return e.statusCode;
  if (e.lastError !== undefined) return providerStatusCode(e.lastError);
  return undefined;
}
