'use client';

import { use } from 'react';
import Link from 'next/link';
import { useExhibitHistory, NotFoundError } from '@/hooks/useExhibitHistory';
import { ExhibitHeader } from '@/components/exhibit/ExhibitHeader';
import { Timeline } from '@/components/exhibit/Timeline';
import { ExhibitNotFound } from '@/components/exhibit/ExhibitNotFound';

export default function ExhibitDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, isLoading, error } = useExhibitHistory(id);

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
      <Timeline entries={data.timeline} />
    </div>
  );
}
