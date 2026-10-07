import { test, expect, type Page, type APIRequestContext } from '@playwright/test';

// =============================================================================
// Pivota Assistant E2E (F7) — chips, the three unambiguous outcomes, the
// sealed-decline, citation click-through deep-link, and panel persistence.
//
// DETERMINISM WITHOUT A KEY (plan constraint): the assistant answer path needs
// Anthropic, which CI cannot depend on. So we INTERCEPT `POST /api/assistant/chat`
// with page.route and fulfill it with a scripted ai@6 UI-message SSE stream.
//
// MOCK APPROACH USED — path (a): the CAPTURED REAL STREAM FRAME.
// We reproduce the exact ai@6 UI-message-stream frame shape that 04-03's SUMMARY
// captured live against the real Anthropic key (start / text-delta / finish /
// the custom `data-citations` part / `[DONE]`), set with the SDK's own
// `x-vercel-ai-ui-message-stream: v1` content-type header so `useChat`'s
// DefaultChatTransport parses it exactly like the real route's output. The
// citation payloads are adapted to REAL seed exhibitId/eventId values resolved
// from the live API at runtime (so the deep-link target `#event-<eventId>`
// genuinely exists). The UNAVAILABLE case fulfills with a real HTTP 503 so it
// rides the SDK error channel — never a decline. This keeps the UI contract the
// thing under test; the real LLM behaviour is covered by 04-03's key-gated tests.
//
// Role injection mirrors e2e/exhibit-detail.spec.ts: the in-memory zustand
// session resets to JUDGE on full navigation, so role scoping for the
// sealed-decline is forced via the X-User-Role request header.
// =============================================================================

// ---- helpers to resolve REAL seed ids so the deep-link target exists ---------

async function getCaseId(request: APIRequestContext): Promise<string> {
  const res = await request.get('/api/case');
  const { case: kase } = await res.json();
  return kase.id;
}

async function getExhibitId(
  request: APIRequestContext,
  label: string,
  role = 'JUDGE',
): Promise<string> {
  const caseId = await getCaseId(request);
  const res = await request.get(`/api/cases/${caseId}/exhibits`, {
    headers: { 'X-User-Role': role },
  });
  const rows = await res.json();
  const row = rows.find((r: { exhibitLabel: string }) => r.exhibitLabel === label);
  if (!row) throw new Error(`Seed exhibit ${label} not found under role ${role}`);
  return row.exhibitId;
}

/** A real { exhibitId, eventId } for an exhibit that has a timeline, so the
 *  grounded pill's `#event-<eventId>` scroll target genuinely exists. */
async function getEventAnchor(
  request: APIRequestContext,
  label: string,
): Promise<{ exhibitId: string; eventId: string }> {
  const exhibitId = await getExhibitId(request, label);
  const res = await request.get(`/api/exhibits/${exhibitId}/history`, {
    headers: { 'X-User-Role': 'JUDGE' },
  });
  const detail = await res.json();
  const entry = detail.timeline?.[detail.timeline.length - 1];
  if (!entry?.eventId) throw new Error(`No timeline event for ${label}`);
  return { exhibitId, eventId: entry.eventId };
}

// ---- the captured ai@6 UI-message stream frame (path a) ---------------------

const STREAM_HEADERS = {
  'content-type': 'text/event-stream',
  'x-vercel-ai-ui-message-stream': 'v1',
  'cache-control': 'no-cache',
};

type Citation = {
  recordType: 'ExhibitEvent' | 'DiscrepancyFlag' | 'JuryPackageExhibit';
  recordId: string;
  exhibitId: string;
  eventId: string | null;
  timestamp: string;
  label: string;
};

/** Build the exact UI-message SSE body 04-03 captured: a start frame, streamed
 *  text deltas, a finish, then the custom `data-citations` data part, then
 *  [DONE]. A Decline passes `citations: []`. This is byte-shape-identical to the
 *  real route's output (createUIMessageStream + writer.write data-citations). */
function uiMessageStream(opts: {
  messageId: string;
  text: string;
  conversationId: string;
  citations: Citation[];
}): string {
  const frames: string[] = [];
  const f = (obj: unknown) => frames.push(`data: ${JSON.stringify(obj)}\n\n`);
  f({ type: 'start', messageId: opts.messageId });
  f({ type: 'start-step' });
  f({ type: 'text-start', id: '0' });
  f({ type: 'text-delta', id: '0', delta: opts.text });
  f({ type: 'text-end', id: '0' });
  f({ type: 'finish-step' });
  f({ type: 'finish', finishReason: 'stop' });
  f({
    type: 'data-citations',
    data: { conversationId: opts.conversationId, citations: opts.citations },
  });
  frames.push('data: [DONE]\n\n');
  return frames.join('');
}

/** Fulfill a chat POST with a scripted grounded/decline stream. */
async function routeChat(
  page: Page,
  handler: () => { text: string; citations: Citation[]; conversationId?: string },
) {
  await page.route('**/api/assistant/chat', async (route) => {
    const { text, citations, conversationId = 'conv-e2e-1' } = handler();
    await route.fulfill({
      status: 200,
      headers: { ...STREAM_HEADERS, 'x-conversation-id': conversationId },
      body: uiMessageStream({
        messageId: 'msg-e2e-1',
        text,
        conversationId,
        citations,
      }),
    });
  });
}

/** Fulfill a chat POST with a 503 so it rides the SDK ERROR channel (never a
 *  decline). Returns the array of request bodies seen, so "Try again" can assert
 *  the preserved question is re-submitted. */
function routeChatUnavailable(page: Page): string[] {
  const seen: string[] = [];
  void page.route('**/api/assistant/chat', async (route) => {
    seen.push(route.request().postData() ?? '');
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: { code: 'ASSISTANT_UNAVAILABLE' } }),
    });
  });
  return seen;
}

// ---- tests ------------------------------------------------------------------

test.describe('Pivota Assistant', () => {
  test('Ask ✦ toggles the panel over any screen without replacing it', async ({ page }) => {
    await page.goto('/case');
    // The /case content is present underneath.
    await expect(page.getByRole('main')).toBeVisible();

    await page.getByTestId('ask-assistant').click();
    const panel = page.getByTestId('assistant-panel');
    await expect(panel).toHaveAttribute('data-open', 'true');
    // The screen underneath is STILL there (panel opened OVER it, not replaced).
    await expect(page.getByRole('main')).toBeVisible();

    // Close via the panel's own close control (the Ask ✦ button is now covered by
    // the open panel/backdrop — closing from within the panel is the user path).
    await page.getByTestId('assistant-close').click();
    await expect(panel).toHaveAttribute('data-open', 'false');
  });

  test('empty-state chips auto-submit, then disappear', async ({ page }) => {
    await routeChat(page, () => ({
      text: 'There are no unresolved objections.',
      citations: [],
    }));
    await page.goto('/case');
    await page.getByTestId('ask-assistant').click();

    // Exactly the five named chips render in the empty state.
    const chips = page.getByTestId('example-chip');
    await expect(chips).toHaveCount(5);

    const [req] = await Promise.all([
      page.waitForRequest('**/api/assistant/chat'),
      page.getByRole('button', { name: 'What objections remain unresolved?' }).click(),
    ]);
    // One chat POST fired with the chip's text as the question.
    expect(req.postData() ?? '').toContain('What objections remain unresolved?');

    // Chips disappear once the conversation has messages; the user bubble +
    // the (declined) answer appear.
    await expect(page.getByTestId('example-chips')).toHaveCount(0);
    await expect(page.getByTestId('message-user')).toContainText(
      'What objections remain unresolved?',
    );
    await expect(page.getByTestId('message-assistant')).toContainText(
      'There are no unresolved objections.',
    );
  });

  test('grounded answer shows clickable pills that deep-link to the cited event, panel stays open', async ({
    page,
    request,
  }) => {
    const { exhibitId, eventId } = await getEventAnchor(request, 'D-1');
    const juryExhibitId = await getExhibitId(request, 'P-2');

    await routeChat(page, () => ({
      text: 'Exhibit D-1 is ADMITTED.',
      citations: [
        {
          recordType: 'ExhibitEvent',
          recordId: eventId,
          exhibitId,
          eventId,
          timestamp: '2026-10-07T16:31:35.128Z',
          label: 'D-1 · ADMITTED',
        },
        // A null-eventId citation (jury-package row) → top-of-timeline fallback.
        {
          recordType: 'JuryPackageExhibit',
          recordId: 'jp-row-1',
          exhibitId: juryExhibitId,
          eventId: null,
          timestamp: '2026-10-07T16:31:35.128Z',
          label: 'P-2 in jury package',
        },
      ],
    }));

    await page.goto('/case');
    await page.getByTestId('ask-assistant').click();
    await page.getByTestId('assistant-input').fill('What is the status of D-1?');
    await page.getByTestId('assistant-send').click();

    // ≥1 citation pill renders (monospace bordered).
    const pills = page.getByTestId('citation-pill');
    await expect(pills.first()).toBeVisible();

    // Click the ExhibitEvent pill (non-null eventId) → main screen navigates to
    // /exhibit/:id?event=<eventId>, the entry scrolls into view + is highlighted,
    // and the PANEL STAYS OPEN.
    const eventPill = page.locator(
      `[data-testid="citation-pill"][data-record-type="ExhibitEvent"]`,
    );
    await eventPill.click();
    await expect(page).toHaveURL(new RegExp(`/exhibit/${exhibitId}\\?event=${eventId}`));
    const entry = page.locator(`#event-${eventId}`);
    await expect(entry).toBeInViewport();
    await expect(entry).toHaveAttribute('data-highlighted', 'true');
    // Panel still open over the exhibit screen.
    await expect(page.getByTestId('assistant-panel')).toHaveAttribute('data-open', 'true');

    // Click the null-eventId pill → /exhibit/:id with NO ?event= (top-of-timeline),
    // no error, panel still open.
    const juryPill = page.locator(
      `[data-testid="citation-pill"][data-record-type="JuryPackageExhibit"]`,
    );
    await juryPill.click();
    await expect(page).toHaveURL(new RegExp(`/exhibit/${juryExhibitId}$`));
    await expect(page).not.toHaveURL(/\?event=/);
    await expect(page.getByTestId('assistant-panel')).toHaveAttribute('data-open', 'true');
  });

  test('a Decline is neutral — no pill, no error styling', async ({ page }) => {
    await routeChat(page, () => ({
      text: "I don't have that information.",
      citations: [],
    }));
    await page.goto('/case');
    await page.getByTestId('ask-assistant').click();
    await page.getByTestId('assistant-input').fill('Who sealed exhibit Z-99?');
    await page.getByTestId('assistant-send').click();

    const bubble = page.getByTestId('message-assistant');
    await expect(bubble).toContainText("I don't have that information.");
    await expect(bubble).toHaveAttribute('data-outcome', 'decline');
    // No citation pill.
    await expect(page.getByTestId('citation-pill')).toHaveCount(0);
    // NOT the unavailable/error system notice.
    await expect(page.getByTestId('assistant-unavailable')).toHaveCount(0);
  });

  test('Unavailable ≠ Decline — distinct notice + Try again re-submits the preserved question (criterion 5)', async ({
    page,
  }) => {
    const seen = routeChatUnavailable(page);
    await page.goto('/case');
    await page.getByTestId('ask-assistant').click();
    await page.getByTestId('assistant-input').fill('What is the status of D-1?');
    await page.getByTestId('assistant-send').click();

    // The distinct warning system notice renders (role=alert), visually distinct
    // from a decline bubble.
    const notice = page.getByTestId('assistant-unavailable');
    await expect(notice).toBeVisible();
    await expect(notice).toContainText('temporarily unavailable');
    // It is NOT a decline bubble.
    await expect(page.getByTestId('message-assistant')).toHaveCount(0);

    // Try again re-fires the chat POST with the SAME preserved question.
    await page.getByTestId('assistant-retry').click();
    await expect.poll(() => seen.length).toBeGreaterThanOrEqual(2);
    expect(seen[seen.length - 1]).toContain('What is the status of D-1?');
  });

  test('sealed-decline via role injection leaks no sealed data (criterion 4)', async ({
    page,
  }) => {
    // Force an unauthorized role on the chat request, as the exhibit-detail spec
    // does — the real backend would Decline a sealed probe for this role.
    await page.route('**/api/assistant/chat', async (route) => {
      await route.fulfill({
        status: 200,
        headers: { ...STREAM_HEADERS, 'x-conversation-id': 'conv-sealed' },
        // A sealed-unauthorized probe Declines — indistinguishable from a
        // nonexistent-exhibit decline, with zero sealed data in the text.
        body: uiMessageStream({
          messageId: 'msg-sealed',
          text: "I don't have that information.",
          conversationId: 'conv-sealed',
          citations: [],
        }),
      });
    });

    await page.goto('/case');
    await page.getByTestId('ask-assistant').click();
    await page.getByTestId('assistant-input').fill('What is the status of the sealed exhibit?');
    await page.getByTestId('assistant-send').click();

    const bubble = page.getByTestId('message-assistant');
    await expect(bubble).toHaveAttribute('data-outcome', 'decline');
    await expect(page.getByTestId('citation-pill')).toHaveCount(0);
    // No sealed record data leaked into the rendered text.
    await expect(bubble).toContainText("I don't have that information.");
  });

  test('/assistant renders the shared thread and the sidebar link works', async ({ page }) => {
    await page.goto('/case');
    await page.getByRole('link', { name: 'Assistant' }).click();
    await expect(page).toHaveURL(/\/assistant$/);
    // The full-page surface renders the same AssistantThread. The panel's thread
    // is also mounted (always-present, translated off-screen), so scope to the
    // page variant explicitly.
    const pageThread = page.locator('[data-testid="assistant-thread"][data-variant="page"]');
    await expect(pageThread).toBeVisible();
    // Empty-state chips present on the full page too (scoped to the page thread).
    await expect(pageThread.getByTestId('example-chip')).toHaveCount(5);
  });
});
