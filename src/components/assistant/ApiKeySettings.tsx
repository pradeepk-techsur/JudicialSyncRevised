'use client';

import { useState } from 'react';
import { Button, Checkbox, PasswordInput } from '@carbon/react';
import { maskApiKey, useApiKeyStore } from '@/stores/apiKeyStore';
import { ANTHROPIC_KEY_PATTERN } from '@/lib/constants';
import styles from './ApiKeySettings.module.scss';

// =============================================================================
// ApiKeySettings — bring-your-own-key entry for the Pivota Assistant (F7).
//
// Rendered inline in AssistantThread (not a Carbon Modal: the slide-over panel
// must not trap focus — see AssistantPanel). The key is kept in the browser by
// useApiKeyStore and sent only with this user's assistant requests; the server
// uses it per request and never stores it. The full key is never displayed
// again after saving — only its last four characters.
// =============================================================================

export interface ApiKeySettingsProps {
  /** Called after a key is saved or removed, e.g. to collapse the form. */
  onDone?: () => void;
}

export function ApiKeySettings({ onDone }: ApiKeySettingsProps) {
  const apiKey = useApiKeyStore((s) => s.apiKey);
  const savedRemember = useApiKeyStore((s) => s.remember);
  const setApiKey = useApiKeyStore((s) => s.setApiKey);
  const clearApiKey = useApiKeyStore((s) => s.clearApiKey);

  const [draft, setDraft] = useState('');
  const [remember, setRemember] = useState(savedRemember);
  const [touched, setTouched] = useState(false);

  const trimmed = draft.trim();
  const invalid = touched && trimmed !== '' && !ANTHROPIC_KEY_PATTERN.test(trimmed);

  return (
    <form
      className={styles.settings}
      data-testid="assistant-api-key-settings"
      onSubmit={(e) => {
        e.preventDefault();
        setTouched(true);
        if (!ANTHROPIC_KEY_PATTERN.test(trimmed)) return;
        setApiKey(trimmed, remember);
        setDraft('');
        setTouched(false);
        onDone?.();
      }}
    >
      <p className={styles.status} data-testid="assistant-api-key-status">
        {apiKey
          ? `Using your Anthropic API key ${maskApiKey(apiKey)}.`
          : 'No API key added. Add your Anthropic API key to use the assistant.'}
      </p>

      <PasswordInput
        id="assistant-api-key"
        data-testid="assistant-api-key-input"
        labelText={apiKey ? 'Replace API key' : 'Anthropic API key'}
        placeholder="sk-ant-…"
        autoComplete="off"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => setTouched(true)}
        invalid={invalid}
        invalidText="That doesn't look like an Anthropic API key (it should start with sk-ant-)."
        size="sm"
      />

      <Checkbox
        id="assistant-api-key-remember"
        data-testid="assistant-api-key-remember"
        labelText="Remember on this browser"
        checked={remember}
        onChange={(_, { checked }) => setRemember(checked)}
      />

      <p className={styles.help}>
        Your key stays in this browser and is sent only with your assistant
        requests. It is never saved on the server.
        {remember ? '' : ' It is forgotten when you close this tab.'}
      </p>

      <div className={styles.actions}>
        <Button type="submit" size="sm" data-testid="assistant-api-key-save" disabled={!trimmed}>
          Save key
        </Button>
        {apiKey && (
          <Button
            kind="ghost"
            size="sm"
            data-testid="assistant-api-key-remove"
            onClick={() => {
              clearApiKey();
              setDraft('');
              setRemember(false);
              setTouched(false);
            }}
          >
            Remove key
          </Button>
        )}
      </div>
    </form>
  );
}
