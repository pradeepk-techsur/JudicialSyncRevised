import type { ExhibitStatus } from '@prisma/client';

const STATUS_CONFIG: Record<ExhibitStatus, { label: string; dotClassName: string }> = {
  MARKED: { label: 'Marked', dotClassName: 'bg-gray-400' },
  OFFERED: { label: 'Offered', dotClassName: 'bg-blue-500' },
  OBJECTED: { label: 'Objected', dotClassName: 'bg-amber-500' },
  ADMITTED: { label: 'Admitted', dotClassName: 'bg-green-600' },
  EXCLUDED: { label: 'Excluded', dotClassName: 'bg-red-600' },
  WITHDRAWN: { label: 'Withdrawn', dotClassName: 'bg-slate-600' },
};

export function StatusBadge({ status }: { status: ExhibitStatus | null }) {
  if (status === null) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-gray-500" aria-label="Current status: not yet entered">
        <span className="h-2 w-2 rounded-full bg-gray-300" aria-hidden="true" />
        Not yet entered
      </span>
    );
  }
  const { label, dotClassName } = STATUS_CONFIG[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 text-sm font-medium"
      aria-label={`Current status: ${label}`}
    >
      <span className={`h-2 w-2 rounded-full ${dotClassName}`} aria-hidden="true" />
      {label}
    </span>
  );
}
