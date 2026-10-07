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
