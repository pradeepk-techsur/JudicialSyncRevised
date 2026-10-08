import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  assistantStreamErrorCode,
  normalizeUserApiKey,
  resolveAnthropicApiKey,
} from '@/lib/assistantConfig';

// Bring-your-own-key resolution (F7). Pure functions — no database, no network.

const VALID_KEY = `sk-ant-api03-${'a'.repeat(40)}`;
const OTHER_VALID_KEY = `sk-ant-api03-${'b'.repeat(40)}`;

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('normalizeUserApiKey', () => {
  it('accepts an Anthropic-shaped key and trims surrounding whitespace', () => {
    expect(normalizeUserApiKey(`  ${VALID_KEY}\n`)).toBe(VALID_KEY);
  });

  it('rejects empty, placeholder, wrong-prefix, too-short and oversized keys', () => {
    expect(normalizeUserApiKey(undefined)).toBeUndefined();
    expect(normalizeUserApiKey('')).toBeUndefined();
    expect(normalizeUserApiKey('sk-ant-REPLACE_ME')).toBeUndefined();
    expect(normalizeUserApiKey(`sk-proj-${'a'.repeat(40)}`)).toBeUndefined();
    expect(normalizeUserApiKey('sk-ant-short')).toBeUndefined();
    expect(normalizeUserApiKey(`sk-ant-${'a'.repeat(251)}`)).toBeUndefined();
  });

  it('rejects characters that do not belong in a key (e.g. header injection)', () => {
    expect(normalizeUserApiKey(`${VALID_KEY}\r\nX-Evil: 1`)).toBeUndefined();
    expect(normalizeUserApiKey(`sk-ant-${'a'.repeat(20)} ${'b'.repeat(20)}`)).toBeUndefined();
  });
});

describe('resolveAnthropicApiKey', () => {
  it('uses the request key when one is supplied, even if the server has a key', () => {
    vi.stubEnv('ANTHROPIC_API_KEY', OTHER_VALID_KEY);
    expect(resolveAnthropicApiKey(VALID_KEY)).toEqual({
      ok: true,
      apiKey: VALID_KEY,
      source: 'request',
    });
  });

  it('rejects a malformed request key rather than falling back to the server key', () => {
    vi.stubEnv('ANTHROPIC_API_KEY', OTHER_VALID_KEY);
    expect(resolveAnthropicApiKey('not-a-key')).toEqual({ ok: false, reason: 'rejected' });
  });

  it('falls back to the server key when no request key is sent', () => {
    vi.stubEnv('ANTHROPIC_API_KEY', OTHER_VALID_KEY);
    expect(resolveAnthropicApiKey(null)).toEqual({
      ok: true,
      apiKey: OTHER_VALID_KEY,
      source: 'server',
    });
    expect(resolveAnthropicApiKey('   ')).toEqual({
      ok: true,
      apiKey: OTHER_VALID_KEY,
      source: 'server',
    });
  });

  it('reports missing when there is neither a request key nor a server key', () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    expect(resolveAnthropicApiKey(null)).toEqual({ ok: false, reason: 'missing' });
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-REPLACE_ME');
    expect(resolveAnthropicApiKey(undefined)).toEqual({ ok: false, reason: 'missing' });
  });
});

describe('assistantStreamErrorCode', () => {
  it('maps a provider 401/403 to ASSISTANT_KEY_REJECTED', () => {
    expect(assistantStreamErrorCode({ statusCode: 401 })).toBe('ASSISTANT_KEY_REJECTED');
    expect(assistantStreamErrorCode({ statusCode: 403 })).toBe('ASSISTANT_KEY_REJECTED');
  });

  it('looks through a retry wrapper to the last provider error', () => {
    expect(assistantStreamErrorCode({ lastError: { statusCode: 401 } })).toBe(
      'ASSISTANT_KEY_REJECTED',
    );
  });

  it('maps everything else to ASSISTANT_UNAVAILABLE and never echoes the error', () => {
    expect(assistantStreamErrorCode({ statusCode: 529 })).toBe('ASSISTANT_UNAVAILABLE');
    expect(assistantStreamErrorCode(new Error('secret config sk-ant-xyz'))).toBe(
      'ASSISTANT_UNAVAILABLE',
    );
    expect(assistantStreamErrorCode(undefined)).toBe('ASSISTANT_UNAVAILABLE');
  });
});
