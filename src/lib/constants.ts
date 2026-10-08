// Single-case demo scope (PROJECT.md) — the fixed case number both the seed
// loader and the case-resolution service key off. Extracted here so neither
// module hardcodes its own copy of this literal.
export const DEMO_CASE_NUMBER = '2026-CR-0142';

// Bring-your-own-key (F7): the request header that carries a browser-supplied
// Anthropic API key to POST /api/assistant/chat. Shared by the client transport
// (useAssistantChat) and the route, so it lives here rather than in the
// server-only assistantConfig module.
export const ASSISTANT_API_KEY_HEADER = 'X-Anthropic-Api-Key';

// Shape of an Anthropic API key: `sk-ant-` then URL-safe characters. The upper
// bound stops an arbitrarily large header being forwarded upstream. Checked in
// the UI (to catch a mis-paste before sending) and again on the server.
export const ANTHROPIC_KEY_PATTERN = /^sk-ant-[A-Za-z0-9_-]{20,250}$/;
