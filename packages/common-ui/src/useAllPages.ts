import type { ErrorPolicy } from '@apollo/client';
import { useEffect, useState } from 'react';

/** The ODB's paged result: one page of `matches` and whether another follows. */
export interface Page {
  readonly matches: readonly { readonly id: string }[];
  readonly hasMore: boolean;
}

/** Apollo's `fetchMore`, narrowed to what `useAllPages` uses. */
type FetchMore<R> = (options: {
  variables: { offset: string };
  errorPolicy: ErrorPolicy | undefined;
  updateQuery: (prev: R, options: { fetchMoreResult: R | undefined }) => R;
}) => Promise<unknown>;

/** The keys of `R` that hold a `Page` (`programs`, `observations`, …). */
type PageKey<R> = { [K in keyof R]: R[K] extends Page ? K : never }[keyof R];

/**
 * Folds the next page into the one held, keeping each id once. An OFFSET_AT
 * cursor repeats the last row of the previous page. OFFSET_AFTER does not.
 *
 * A page with no new rows but `hasMore` set returns `held` as is. Returning
 * `held` means no progress, so `useAllPages` stops and reports `incomplete`.
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
 * Follows a paged ODB query to its last page. `loading` stays true until then,
 * so callers never render a partial list.
 *
 * The ODB caps each page, so a single read silently drops the rest. The query
 * must take an `$offset` cursor variable. Pages merge by hand because the cache
 * has no field policy for these lists.
 *
 * A walk that stops early (a rejected page, or a page with no new rows) reports
 * `incomplete` and releases `loading`. The list is partial, so the view must say
 * so. The flag clears when the list changes or the page reloads.
 *
 * Not caught: the cursor skips rows while the walk still makes progress. `programs`
 * (OFFSET_AT) pages by `id >= cursor` but orders by id, so ids of different
 * lengths can lose rows silently. Other callers are unverified. The fix is in the ODB.
 */
export function useAllPages<R, T extends PagedQuery>(
  result: T & { fetchMore: FetchMore<R> },
  key: PageKey<R>,
): T & { incomplete: boolean } {
  const { fetchMore } = result;
  // `fetchMore` defaults to errorPolicy 'none', which rejects a page with a GraphQL
  // error. Passing the query's policy stops ITC warnings from ending the walk.
  const { errorPolicy } = result.observable.options;
  const page = (result.data as R | undefined)?.[key] as Page | undefined;
  // The page the walk gave up on. A new `page` object clears it, so new data
  // restarts the walk. A refetch that returns the same object keeps it.
  const [stalledAt, setStalledAt] = useState<Page | undefined>(undefined);
  if (stalledAt !== undefined && page !== stalledAt) setStalledAt(undefined);
  // `hasMore` with no rows leaves no cursor to ask from.
  const stranded = page !== undefined && page.hasMore && page.matches.length === 0;
  const incomplete = page !== undefined && (page === stalledAt || stranded);

  // StrictMode runs this effect twice. The second call adds no rows and records a
  // stall on a stale page, which the next render clears.
  useEffect(() => {
    if (!page?.hasMore || page === stalledAt) return;
    const cursor = page.matches.at(-1)?.id;
    if (cursor === undefined) return;
    let merged = false;
    fetchMore({
      variables: { offset: cursor },
      errorPolicy,
      updateQuery: (prev, { fetchMoreResult }) => {
        // Under 'all', a failed page still gets here, with no data to fold in.
        if (!fetchMoreResult) return prev;
        const held = prev[key] as Page;
        const next = mergePage(held, fetchMoreResult[key] as Page);
        merged = next !== held;
        return merged ? { ...fetchMoreResult, [key]: next } : prev;
      },
    }).then(
      // Under 'all', a failed page or one that adds nothing also resolves.
      // `updateQuery` runs first, so `merged` is already set here.
      () => {
        if (!merged) setStalledAt(page);
      },
      // Under 'none', a failed page rejects instead.
      () => setStalledAt(page),
    );
  }, [page, stalledAt, fetchMore, errorPolicy, key]);

  return { ...result, loading: result.loading || ((page?.hasMore ?? false) && !incomplete), incomplete };
}
