import Link from 'next/link';

export function ExhibitNotFound() {
  return (
    <div role="status">
      <h1 className="text-xl font-semibold">Exhibit not found</h1>
      <p className="text-sm text-gray-500">No exhibit found with the given ID.</p>
      <Link href="/case" className="mt-4 inline-block text-sm underline">
        ← Back to Case Workspace
      </Link>
    </div>
  );
}
