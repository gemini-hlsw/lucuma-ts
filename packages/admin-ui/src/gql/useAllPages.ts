import type { ErrorPolicy } from '@apollo/client';
import { useEffect, useState } from 'react';

/** The ODB's paged result: one page of `matches` and whether another follows. */
export interface Page {
  readonly matches: readonly { readonly id: string }[];
  readonly hasMore: boolean;
}

/** What `useAllPages` needs of Apollo's `fetchMore`: ask for the page after
 *  `offset` and say how to fold it into the result held. */
type FetchMore<R> = (options: {
  variables: { offset: string };
  errorPolicy: ErrorPolicy | undefined;
  updateQuery: (prev: R, options: { fetchMoreResult: R | undefined }) => R;
}) => Promise<unknown>;

/** The keys of `R` that hold a `Page` (`programs`, `observations`, …). */
type PageKey<R> = { [K in keyof R]: R[K] extends Page ? K : never }[keyof R];

/**
 * Folds the next page into the one held. The ODB's OFFSET is inclusive, so a
 * page repeats the previous page's last row; keeping each id once leaves one row
 * per item.
 *
 * A page that claims more but adds nothing leaves the cursor where it was, and
 * returns `held` itself: an untouched result keeps the same identity, so the
 * walk stops asking there instead of asking for this page for ever. (Measured on
 * dev with a LIMIT, not by this query: a later page of `programs` came back as the
 * same rows with `hasMore` still true.) `hasMore` stays true, so `useAllPages` reports it as `incomplete`.
 */
export function mergePage(held: Page, next: Page): Page {
  const seen = new Set(held.matches.map((m) => m.id));
  const added = next.matches.filter((m) => !seen.has(m.id));
  if (added.length === 0 && next.hasMore) return held;
  return { ...next, matches: [...held.matches, ...added] };
}

/** The parts of Apollo's `useQuery` result that `useAllPages` reads. */
interface PagedQuery {
  readonly data: unknown;
  readonly loading: boolean;
  readonly observable: { readonly options: { readonly errorPolicy?: ErrorPolicy } };
}

/**
 * Follows a paged ODB query to its last page and returns its result, with
 * `loading` held until the last page is in so callers never render a partial
 * set. `key` names the field holding the `Page`, as in `useQueryAndSubscription`.
 *
 * The ODB caps a page (`ResultMapping.MaxLimit`), so a list read once would
 * silently drop whatever lies past it. The query must take an `$offset` cursor
 * variable. Each page is merged by hand because the cache has no field policy
 * for these lists.
 *
 * A walk that cannot finish — a page is rejected, or claims more but adds
 * nothing — stops and reports `incomplete`, with `loading` released: the list
 * shown is only part of it and the view must say so rather than read as loaded.
 * It stays so until the list changes or the page is reloaded.
 *
 * What it cannot catch: a page that makes progress while the ODB's cursor skips
 * rows. `programs` pages by `id >= cursor` but orders by id, and the two can
 * disagree for ids of different lengths (measured: a LIMIT-20 walk of 55 rows
 * collected 54), so a list long enough to need a second page can lose rows with
 * no sign. The remedy is in the ODB, not here.
 */
export function useAllPages<R, T extends PagedQuery>(
  result: T & { fetchMore: FetchMore<R> },
  key: PageKey<R>,
): T & { incomplete: boolean } {
  const { fetchMore } = result;
  // `fetchMore` does not follow the query's `errorPolicy`: left alone it uses
  // 'none' and rejects any page that comes back with a GraphQL error, so under
  // 'all' (per-observation ITC warnings) the walk would stop on its first page.
  const { errorPolicy } = result.observable.options;
  const page = (result.data as R | undefined)?.[key] as Page | undefined;
  // The page the walk gave up on. It stays marked only while that same page is
  // the one held: a refetch that brings back different data, or a query that
  // moves to other variables and back, is a different page, so the walk runs
  // again. A refetch that comes back as the very same page object changes nothing,
  // and the list stays marked incomplete.
  const [stalledAt, setStalledAt] = useState<Page | undefined>(undefined);
  if (stalledAt !== undefined && page !== stalledAt) setStalledAt(undefined);
  // A page that claims more but holds no row leaves no cursor to ask from.
  const stranded = page !== undefined && page.hasMore && page.matches.length === 0;
  const incomplete = page !== undefined && (page === stalledAt || stranded);

  // Under StrictMode this runs twice and asks for the same page twice; the second
  // answer adds nothing, and the stall it records is keyed on a page that is no
  // longer the one held.
  useEffect(() => {
    if (!page?.hasMore || page === stalledAt) return;
    const cursor = page.matches.at(-1)?.id;
    if (cursor === undefined) return;
    let merged = false;
    fetchMore({
      variables: { offset: cursor },
      errorPolicy,
      updateQuery: (prev, { fetchMoreResult }) => {
        // No data: under errorPolicy 'all' a page that fails outright still gets
        // here (measured), carrying nothing to fold in.
        if (!fetchMoreResult) return prev;
        const held = prev[key] as Page;
        const next = mergePage(held, fetchMoreResult[key] as Page);
        merged = next !== held;
        return merged ? { ...fetchMoreResult, [key]: next } : prev;
      },
    }).then(
      // Under errorPolicy 'all' a page that fails outright still resolves, with
      // no data to merge; so does a page that adds nothing. Either way the walk
      // cannot go on. `merged` is read here because `updateQuery` runs before this
      // settles (the tests that pin the stall fail if that order changes).
      () => {
        if (!merged) setStalledAt(page);
      },
      // Under 'none' the same failure rejects instead.
      () => setStalledAt(page),
    );
  }, [page, stalledAt, fetchMore, errorPolicy, key]);

  return { ...result, loading: result.loading || ((page?.hasMore ?? false) && !incomplete), incomplete };
}
