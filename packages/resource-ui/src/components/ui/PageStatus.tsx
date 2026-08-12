/**
 * What a page says when it has nothing to draw yet, or nothing to draw at all.
 *
 * Three small components rather than one that decides between them: the pages'
 * branching genuinely differs - the night view alone has three distinct empty
 * states, one of which carries a button offering the nearest covered night -
 * and a component that took `loading`, `error` and `empty` together would have
 * to grow a prop for every one of those differences. What was worth sharing is
 * the ink: the red of a failure, the muted grey of a wait, the bordered panel of
 * an honest absence.
 */
import type { JSX, ReactNode } from 'react';

/**
 * A query that failed, in the reserved red, announced to assistive readers.
 *
 * `what` is the page's own noun so the sentence reads: "Could not load the
 * night: …". The message is the error's own, verbatim - a failure a reader
 * cannot quote is a failure they cannot report.
 */
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

/**
 * An honest absence - nothing is recorded, or nothing matches - in the same
 * bordered panel everywhere, so "there is nothing here" never reads as an error.
 *
 * Never red and never a warning: a gap means "not recorded", never
 * "unavailable" (I4), and the panel's job is to say so plainly.
 */
export function EmptyPanel({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div className="rounded border border-subtle bg-surface p-3 text-sm text-foreground-secondary">{children}</div>
  );
}
