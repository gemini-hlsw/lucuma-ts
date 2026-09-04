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
  /** Whether the view has no rows to show. Also gates `error`: an error that
   *  arrived alongside data (a partial warning) is not treated as a failure. */
  empty?: boolean;
}): JSX.Element {
  if (loading) {
    return (
      <span className="ds-badge ds-loading" title="Querying…">
        <Spinner spin /> Loading…
      </span>
    );
  }
  // An error only means "failed" when it left the view with nothing to show.
  // With Apollo's errorPolicy 'all' (see ApolloConfigs), a query can return a
  // full result *alongside* a benign per-observation warning — that's still
  // live data, not a failure, so it must not win over the rows (sc-10153).
  if (error !== undefined && empty !== false) {
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
