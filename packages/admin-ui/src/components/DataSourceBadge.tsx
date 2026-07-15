import './DataSourceBadge.css';

import type { JSX } from 'react';

import { Circle, CircleDot, Spinner, TriangleExclamation } from '@/components/Icons';

/** Small status chip for a view's live query: loading, live, empty, or the
 *  error itself — the view never fakes data to cover a failure. */
export function DataSourceBadge({
  loading,
  error,
  empty,
}: {
  loading: boolean;
  /** Present when the query failed (expired token, access denied, …). */
  error?: string;
  /** True when the query succeeded but returned nothing for this token. */
  empty?: boolean;
}): JSX.Element {
  if (loading) {
    return (
      <span className="ds-badge ds-loading" title="Querying…">
        <Spinner spin /> Loading…
      </span>
    );
  }
  if (error !== undefined) {
    return (
      <span className="ds-badge ds-warn" title={error}>
        <TriangleExclamation /> {error}
      </span>
    );
  }
  if (empty) {
    return (
      <span className="ds-badge ds-empty" title="The query returned no rows your role can see.">
        <Circle /> No records for your role
      </span>
    );
  }
  return (
    <span className="ds-badge ds-live" title="Live data.">
      <CircleDot /> Live data
    </span>
  );
}
