import { create } from 'zustand';

// Bring-your-own-key (F7): the user's own Anthropic API key, held in the
// BROWSER only. useAssistantChat sends it per request in the
// ASSISTANT_API_KEY_HEADER header; the server uses it for that request and
// never stores it. This lets a deployment with no server key still offer a
// working assistant without exposing a shared key behind an unauthenticated URL.
//
// Where it lives:
//   - remember = false (default) → sessionStorage: survives reloads, gone when
//     the tab closes.
//   - remember = true            → localStorage: survives until removed.
// Storage access is wrapped because it throws in some private-browsing modes;
// the key then simply lasts for the page's lifetime.
//
// Hydration is explicit (hydrate(), called from an effect) rather than at module
// load, so the server render and the first client render agree (no key) and
// React does not report a hydration mismatch.

const STORAGE_KEY = 'judicialsync.anthropicApiKey';

interface ApiKeyState {
  apiKey: string | null;
  remember: boolean;
  hydrated: boolean;
  /** Load a previously saved key from browser storage. Idempotent. */
  hydrate: () => void;
  setApiKey: (apiKey: string, remember: boolean) => void;
  clearApiKey: () => void;
}

function readStorage(storage: () => Storage): string | null {
  try {
    return storage().getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStorage(storage: () => Storage, value: string | null): void {
  try {
    if (value === null) storage().removeItem(STORAGE_KEY);
    else storage().setItem(STORAGE_KEY, value);
  } catch {
    /* storage unavailable — key stays in memory only */
  }
}

const local = () => window.localStorage;
const session = () => window.sessionStorage;

export const useApiKeyStore = create<ApiKeyState>((set, get) => ({
  apiKey: null,
  remember: false,
  hydrated: false,
  hydrate: () => {
    if (get().hydrated || typeof window === 'undefined') return;
    const remembered = readStorage(local);
    if (remembered) {
      set({ apiKey: remembered, remember: true, hydrated: true });
      return;
    }
    set({ apiKey: readStorage(session), remember: false, hydrated: true });
  },
  setApiKey: (apiKey, remember) => {
    // Write to exactly one storage so unticking "remember" really forgets it.
    writeStorage(remember ? local : session, apiKey);
    writeStorage(remember ? session : local, null);
    set({ apiKey, remember, hydrated: true });
  },
  clearApiKey: () => {
    writeStorage(local, null);
    writeStorage(session, null);
    set({ apiKey: null, remember: false });
  },
}));

/** Last four characters, for "using key …abcd" without displaying the key. */
export function maskApiKey(apiKey: string): string {
  return `…${apiKey.slice(-4)}`;
}
