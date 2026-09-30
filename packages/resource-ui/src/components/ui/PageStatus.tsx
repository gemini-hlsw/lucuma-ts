import { faLayerGroup } from '@fortawesome/pro-regular-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { JSX, ReactNode } from 'react';

/** The message is the error's own, verbatim: a failure a reader cannot quote cannot be reported. */
export function ErrorAlert({ what, error }: { what: string; error: Error }): JSX.Element {
  return (
    <p role="alert" className="mb-4 rounded border border-danger-edge/60 bg-danger-fill/30 p-3 text-sm text-danger-ink">
      Could not load {what}: {error.message}
    </p>
  );
}

export function Loading({ what }: { what: string }): JSX.Element {
  return (
    <div className="flex animate-loader-appear flex-col items-center gap-3 py-10 text-xs text-foreground-secondary motion-reduce:animate-none">
      {/* The Resource mark, not type: the words beneath it say what is loading, and its hop says the wait is live. */}
      <FontAwesomeIcon
        icon={faLayerGroup}
        size="3x"
        widthAuto
        aria-hidden="true"
        className="origin-bottom animate-loader-hop text-gpp motion-reduce:animate-none"
      />
      <p>Loading {what}…</p>
    </div>
  );
}

/** Never red and never a warning: a gap means "not recorded", never "unavailable" (I4). */
export function EmptyPanel({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div className="rounded border border-subtle bg-surface p-3 text-sm text-foreground-secondary">{children}</div>
  );
}
