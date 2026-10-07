'use client';

import { Suspense, use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useExhibitHistory, NotFoundError } from '@/hooks/useExhibitHistory';
import { ExhibitHeader } from '@/components/exhibit/ExhibitHeader';
import { Timeline } from '@/components/exhibit/Timeline';
import { ExhibitNotFound } from '@/components/exhibit/ExhibitNotFound';

function ExhibitDetail({ id }: { id: string }) {
  const { data, isLoading, error } = useExhibitHistory(id);

  // The citation deep-link lands here as /exhibit/:id?event=<eventId>. Read the
  // param and, once data is loaded, scroll the matching timeline entry into view
  // + briefly highlight it. If the event id is absent (null-eventId citation) or
  // not present for this role (sealed-masked / simply missing), fall back to
  // top-of-timeline — no error (CONTEXT.md). The param is only ever used to look
  // up an element id + drive a highlight class; it is never interpolated into
  // HTML or a navigation target (T-04-15 / T-04-16).
  const searchParams = useSearchParams();
  const eventParam = searchParams.get('event');
  const [highlightEventId, setHighlightEventId] = useState<string | null>(null);

  useEffect(() => {
    if (!data || !eventParam) {
      setHighlightEventId(null);
      return;
    }
    const el = document.getElementById(`event-${eventParam}`);
    if (!el) {
      // Event not present for this role / this exhibit — top-of-timeline fallback.
      setHighlightEventId(null);
      return;
    }
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightEventId(eventParam);
    // Brief highlight, then fade (the Timeline's transition handles the fade-out
    // once the class is removed). ~400ms per the Y0-patterns highlight convention.
    const t = setTimeout(() => setHighlightEventId(null), 400);
    return () => clearTimeout(t);
  }, [data, eventParam]);

  if (error instanceof NotFoundError) {
    return <ExhibitNotFound />;
  }
  if (isLoading) {
    return <p className="text-sm text-gray-500">Loading exhibit history…</p>;
  }
  if (error || !data) {
    return <p className="text-sm text-red-600">Unable to load exhibit history — please retry.</p>;
  }

  return (
    <div>
      <Link href="/case" className="mb-4 inline-block text-sm underline">
        ← Back to Case Workspace
      </Link>
      <ExhibitHeader data={data} />
      <h2 className="mb-2 text-lg font-medium">History</h2>
      <Timeline entries={data.timeline} highlightEventId={highlightEventId} />
    </div>
  );
}

export default function ExhibitDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  // useSearchParams requires a Suspense boundary (Next 16) — wrap the detail so
  // the ?event deep-link read doesn't opt the whole route out of static handling.
  return (
    <Suspense fallback={<p className="text-sm text-gray-500">Loading exhibit history…</p>}>
      <ExhibitDetail id={id} />
    </Suspense>
  );
}
