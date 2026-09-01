import type { JSX, ReactNode } from 'react';

/** The message is the error's own, verbatim: a failure a reader cannot quote cannot be reported. */
export function ErrorAlert({ what, error }: { what: string; error: Error }): JSX.Element {
  return (
    <p role="alert" className="mb-4 rounded border border-red-700/60 bg-red-900/30 p-3 text-sm text-red-100">
      Could not load {what}: {error.message}
    </p>
  );
}

/** A query in flight. Quiet on purpose: it is chrome, not a finding. */
export function Loading({ what }: { what: string }): JSX.Element {
  return <p className="text-sm text-foreground-muted">Loading {what}…</p>;
}

/** Never red and never a warning: a gap means "not recorded", never "unavailable" (I4). */
export function EmptyPanel({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div className="rounded border border-subtle bg-surface p-3 text-sm text-foreground-secondary">{children}</div>
  );
}
