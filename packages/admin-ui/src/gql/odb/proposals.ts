/*
 * Proposals view (sc-9092): special-type proposals (Director's Time / Poor
 * Weather), reached via programs.proposal — the ODB scopes this to what the
 * token can see.
 */
import { skipToken, useMutation, useQuery } from '@apollo/client/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { Proposal, SpecialProposalType } from '../types';
import type { DocumentType } from './gen';
import { graphql } from './gen';
import type { ScienceSubtype } from './gen/graphql';
import { isScienceObservation, mapObservationRow, telluricGroupHours } from './shared';

/** Which programs carry a special-type proposal. Deliberately cheap: no
 *  observations and no time estimates, so it stays fast across every program
 *  on the server.
 *
 *  It has no WHERE clause because the ODB cannot filter on the proposal's
 *  science subtype — `WhereProposal` exposes no such field — so the filter
 *  runs client-side in `mapProposals`. A LIMIT would therefore truncate before
 *  filtering and drop special proposals past the first page (sc-9589), which
 *  is why every page is walked. */
export const PROPOSALS_QUERY = graphql(`
  query AdminProposals($offset: ProgramId) {
    programs(OFFSET: $offset) {
      matches {
        id
        name
        description
        proposalStatus
        pi {
          id
          user {
            id
            profile {
              givenName
              familyName
            }
          }
        }
        proposal {
          reference {
            label
          }
          gemini {
            scienceSubtype
          }
        }
      }
      hasMore
    }
  }
`);

/** Observations, time estimates and telluric groups, for the handful of
 *  programs the list actually shows.
 *
 *  Both fields here are per-program expensive: `execution.digest` is the ITC's
 *  asynchronous estimate, and `allGroupElements` carries each group's time
 *  range. Measured on dev (851 programs), either one alone exceeds the 30s
 *  request limit and the tab dies with "the ODB is unreachable" (sc-10520);
 *  asked for the ~50 special proposals they cost about 3s. */
export const PROPOSAL_DETAILS_QUERY = graphql(`
  query AdminProposalDetails($programIds: [ProgramId!]!, $offset: ProgramId) {
    programs(WHERE: { id: { IN: $programIds } }, OFFSET: $offset) {
      matches {
        id
        observations(LIMIT: 200) {
          matches {
            ...ObservationItem
          }
        }
        allGroupElements {
          ...GroupElementItem
        }
      }
      hasMore
    }
  }
`);

export type AdminProposalsResult = DocumentType<typeof PROPOSALS_QUERY>;
export type AdminProposalDetailsResult = DocumentType<typeof PROPOSAL_DETAILS_QUERY>;

/** A program's observations and telluric groups, keyed by program id. A
 *  program missing from the map has not been fetched yet; `useProposals` holds
 *  `loading` until every page is in, so callers never map a partial set. */
export type ProposalDetails = ReadonlyMap<string, AdminProposalDetailsResult['programs']['matches'][number]>;

export function proposalDetailsById(raw: AdminProposalDetailsResult | undefined): ProposalDetails {
  return new Map((raw?.programs.matches ?? []).map((p) => [p.id, p]));
}

/** Stable empty list, so a render before the pages settle doesn't hand Apollo
 *  a new `variables` object and refetch. */
const EMPTY_IDS: readonly string[] = [];

const SPECIAL_SUBTYPES: Partial<Record<ScienceSubtype, SpecialProposalType>> = {
  DIRECTORS_TIME: 'DIRECTORS_TIME',
  POOR_WEATHER: 'POOR_WEATHER',
};

/** The view's kind for a program's proposal, or undefined if it carries none of
 *  interest. The single place that decides what "special" means: the detail
 *  query picks its ids with it and `mapProposals` maps its rows with it, so the
 *  two cannot disagree about which programs need observations fetched. */
function specialTypeOf(
  p: Pick<AdminProposalsResult['programs']['matches'][number], 'proposal'>,
): SpecialProposalType | undefined {
  const subtype = p.proposal?.gemini?.scienceSubtype;
  return subtype ? SPECIAL_SUBTYPES[subtype] : undefined;
}

/** Map programs that carry a special-type proposal into the Proposals view.
 *  A submitted-at timestamp has no ODB field (the same genuine gap as the
 *  Change Requests "received" timestamp) — omitted rather than faked. */
export function mapProposals(raw: AdminProposalsResult, details: ProposalDetails): Proposal[] {
  const out: Proposal[] = [];
  for (const p of raw.programs.matches) {
    const type = specialTypeOf(p);
    if (!p.proposal || !type) continue; // special proposals only
    const prof = p.pi?.user?.profile;
    const reference = p.proposal.reference?.label ?? p.id;
    const detail = details.get(p.id);
    const groupHours = telluricGroupHours(detail?.allGroupElements ?? []);
    out.push({
      id: p.id,
      reference,
      semester: semesterOfReference(reference),
      pi: [prof?.givenName, prof?.familyName].filter(Boolean).join(' ') || '(unknown PI)',
      title: p.name ?? '(untitled)',
      type,
      status: p.proposalStatus,
      abstract: p.description ?? '',
      observations: (detail?.observations.matches ?? [])
        .filter(isScienceObservation)
        .map((o) => mapObservationRow(o, groupHours)),
    });
  }
  return out;
}

/** Stand-in for a page that claims `hasMore` but carries no rows, so a stall
 *  there is still distinguishable from a healthy walk. */
const NO_CURSOR = '';

/** Whether a fetched page carried any rows. `fetchMore` resolves with the raw
 *  page, not the accumulated result, so this is the walk's progress check. */
const pageIsEmpty = (fetched: { data?: { programs: { matches: readonly unknown[] } } }): boolean =>
  (fetched.data?.programs.matches.length ?? 0) === 0;

/** Follow a `hasMore` cursor to the end of a paged result.
 *
 *  Returns the page the walk gave up on, or undefined while it is healthy or
 *  finished, plus a `reset` for a deliberate reload.
 *
 *  Two things wedge a walk and neither reaches the query's `error`: `fetchMore`
 *  can reject — Apollo settles that on the returned promise, not on the hook —
 *  or a page can come back adding no rows while still reporting `hasMore`,
 *  which `errorPolicy: 'all'` permits. Both leave the cursor where it was, so a
 *  naive walk asks for the same page for ever.
 *
 *  The attempt is held in a ref rather than state: it records what is in
 *  flight, which no render needs to see, and keeping it out of state is what
 *  stops a successful page from being mistaken for a stall. Only the give-up is
 *  state, because the badge renders it.
 */
function usePageWalk<R>(
  page: { readonly matches: readonly { readonly id: string }[]; readonly hasMore: boolean } | undefined,
  advance: ((cursor: string, isCurrent: () => boolean) => Promise<R>) | undefined,
  isEmpty: (fetched: R) => boolean,
): { stalledAt: string | undefined; resetWalk: () => void } {
  const [stalledAt, setStalledAt] = useState<string | undefined>(undefined);
  const inFlight = useRef<string | undefined>(undefined);
  // Bumped by `resetWalk`. Clearing the ref alone would not restart the walk:
  // nothing else the effect depends on changes on a reset, so it would never
  // run again to retry the page it stopped on.
  const [generation, setGeneration] = useState(0);
  // Mirrored in a ref so a settled request can tell whether its walk is still
  // the current one without capturing a stale value.
  const generationRef = useRef(0);

  useEffect(() => {
    if (page === undefined || !page.hasMore || advance === undefined) return;
    // A page claiming `hasMore` with no rows leaves nothing to page from, so
    // the walk cannot advance and the caller must be told it is short.
    const cursor = page.matches.at(-1)?.id ?? NO_CURSOR;
    if (cursor === NO_CURSOR || cursor === inFlight.current) return;
    inFlight.current = cursor;
    // The walk this request belongs to. A reset starts a new one, and a late
    // answer from the old walk must not mark it stalled — that would resurrect
    // a warning the reload was meant to clear.
    const walk = generation;
    // True while this request still belongs to the live walk. Handed to the
    // caller because the `.then` below is too late to protect the cache:
    // `fetchMore` runs `updateQuery` inside a `cache.batch` in its `next`
    // handler, synchronously on the network response and before this promise
    // settles (`@apollo/client@4.3.1`, `core/ObservableQuery.js`). A page from
    // a walk a reload has already replaced would otherwise merge carrying its
    // stale `hasMore`, ending the new walk early and silently dropping the
    // programs the reloaded pages would have brought.
    //
    // Deliberately untested. Reaching it needs a reload to land between a
    // request going out and its answer coming back, and the mocked link cannot
    // hold that window open: three attempts either passed with the guard
    // removed or failed with it in place, so each was measuring its own timing
    // rather than this behaviour. None was kept. The guard rests on the Apollo
    // source cited above, not on a green test.
    const isCurrent = () => walk === generationRef.current;
    advance(cursor, isCurrent)
      .then((fetched) => {
        if (!isCurrent()) return;
        // The page answered but carried no rows — legal under
        // `errorPolicy: 'all'`, which lets one resolve with errors and nothing
        // else. The cursor cannot move, and since an unchanged result
        // re-renders nothing the effect will not run again to notice, so the
        // stall has to be caught here, on the response itself.
        if (isEmpty(fetched)) setStalledAt(cursor);
      })
      .catch(() => {
        if (isCurrent()) setStalledAt(cursor);
      });
  }, [page, advance, isEmpty, generation]);

  const resetWalk = useCallback(() => {
    // Cleared so the reloaded pages can be walked again from wherever they now
    // end — including from the same cursor, when the refetch returns a page
    // ending at the same row. A duplicate request is not a risk: the in-flight
    // one belongs to the previous generation, and both its merge and its result
    // are declined.
    inFlight.current = undefined;
    setStalledAt(undefined);
    generationRef.current += 1;
    setGeneration(generationRef.current);
  }, []);

  // A page that claims `hasMore` yet carries no rows can never be paged from,
  // so it is stalled whether or not a request was ever issued.
  const strandedOnEmptyPage = page !== undefined && page.hasMore && page.matches.length === 0;

  return { stalledAt: strandedOnEmptyPage ? NO_CURSOR : stalledAt, resetWalk };
}

/** Merge a detail page into the accumulated result, dropping ids already held.
 *  The ODB's OFFSET cursor is inclusive (`Predicates.program.id.gtEql`), so
 *  every page after the first repeats the previous page's last row; without
 *  this the map would be rebuilt with duplicates and `details.size` could never
 *  be compared against the ids we asked for. */
export function mergeDetailPages(
  prev: AdminProposalDetailsResult,
  { fetchMoreResult }: { fetchMoreResult: AdminProposalDetailsResult },
): AdminProposalDetailsResult {
  const seen = new Set(prev.programs.matches.map((p) => p.id));
  return {
    programs: {
      ...fetchMoreResult.programs,
      matches: [...prev.programs.matches, ...fetchMoreResult.programs.matches.filter((p) => !seen.has(p.id))],
    },
  };
}

/** The special-proposals list — cached rows render immediately, refreshed in
 *  background. Accepting is multi-step (status + allocations + properties),
 *  so the page refetch()es once at the end rather than per mutation.
 *
 *  Two queries, not one. The list walks every program to find the special
 *  proposals (the ODB can't filter on science subtype), and asking for each
 *  one's time estimates along the way is what made this tab time out. The
 *  estimates are fetched afterwards, for the dozen programs that survive the
 *  filter. */
export function useProposals() {
  const result = useQuery(PROPOSALS_QUERY, {
    variables: { offset: null },
    fetchPolicy: 'cache-and-network',
    notifyOnNetworkStatusChange: true,
    // A program the token can't fully read comes back with an entry in the
    // response's `errors`. Under the default policy 'none' that one warning
    // discards the whole result and blanks the tab (sc-10153); 'all' keeps the
    // good rows.
    errorPolicy: 'all',
  });

  const { data, fetchMore } = result;

  // Walk the remaining pages: each fetchMore appends the next page's matches
  // (merged via updateQuery, since the cache has no field policy for this
  // list), using the last loaded id as the cursor, until the ODB reports no
  // more.
  const advanceList = useMemo(
    () =>
      fetchMore === undefined
        ? undefined
        : (cursor: string, isCurrent: () => boolean) =>
            fetchMore({
              variables: { offset: cursor },
              // The OFFSET cursor is inclusive, so each page repeats the
              // previous page's last row; dropping ids already held keeps one
              // row per program.
              updateQuery: (prev, { fetchMoreResult }) => {
                // Superseded by a reload: keep what is there rather than let
                // this page's stale `hasMore` end the new walk.
                if (!isCurrent()) return prev;
                const seen = new Set(prev.programs.matches.map((p) => p.id));
                return {
                  programs: {
                    ...fetchMoreResult.programs,
                    matches: [
                      ...prev.programs.matches,
                      ...fetchMoreResult.programs.matches.filter((p) => !seen.has(p.id)),
                    ],
                  },
                };
              },
            }),
    [fetchMore],
  );
  const { stalledAt: listStalledAt, resetWalk: resetListWalk } = usePageWalk(data?.programs, advanceList, pageIsEmpty);

  // Settled when the ODB reports no more pages, or when the walk gave up and
  // cannot get them — otherwise a rejected page would spin for ever without
  // ever starting the detail query.
  const listSettled = !(data?.programs.hasMore ?? false) || listStalledAt !== undefined;
  // Only the special proposals need observations — that is the whole point of
  // the split. Held until every page is in, so the ids are complete and the
  // detail query runs once rather than once per page. Memoised so Apollo sees
  // a stable `variables` object rather than a new array each render.
  const specialIds = useMemo(
    () =>
      listSettled && data
        ? data.programs.matches.filter((p) => specialTypeOf(p) !== undefined).map((p) => p.id)
        : EMPTY_IDS,
    [listSettled, data],
  );

  const detailResult = useQuery(
    PROPOSAL_DETAILS_QUERY,
    // errorPolicy 'all' for the same reason as the list above: one un-costable
    // observation returns null plus an entry in `errors`, and the default would
    // discard every good row with it (sc-10153).
    specialIds.length === 0
      ? skipToken
      : {
          // Copied because the generated variables type is mutable; the
          // `specialIds` memo is what keeps Apollo from seeing a new query on
          // every render.
          variables: { programIds: [...specialIds], offset: null },
          fetchPolicy: 'cache-and-network',
          // Matches the list query: without it a refetch leaves `loading` false
          // and the badge claims the stale rows are current.
          notifyOnNetworkStatusChange: true,
          errorPolicy: 'all',
        },
  );

  const { data: detailData, fetchMore: fetchMoreDetails } = detailResult;

  // Accepting a proposal writes allocations and program properties, which move
  // the very estimates the detail query selects. Refreshing only the list would
  // leave the Time column showing pre-accept numbers, so both are reloaded —
  // the detail one only when it is actually running, since refetching a
  // skipped query throws.

  // Walk the detail pages. `IN` is not a page size: the ODB caps a page however
  // it likes (`ResultMapping.MaxLimit`), so a run with more special proposals
  // than fit in one page would otherwise drop the overflow — rows rendering
  // with an empty Time column and no error, the same silent truncation sc-9589
  // fixed for the list.
  const advanceDetails = useMemo(
    () =>
      fetchMoreDetails === undefined
        ? undefined
        : (cursor: string, isCurrent: () => boolean) =>
            fetchMoreDetails({
              variables: { offset: cursor },
              updateQuery: (prev, options) => (isCurrent() ? mergeDetailPages(prev, options) : prev),
            }),
    [fetchMoreDetails],
  );
  const { stalledAt: detailStalledAt, resetWalk: resetDetailWalk } = usePageWalk(
    detailData?.programs,
    advanceDetails,
    pageIsEmpty,
  );

  const { refetch: refetchList } = result;
  const { refetch: refetchDetails } = detailResult;
  const detailsRunning = specialIds.length > 0;
  const refetchAll = useCallback(async () => {
    try {
      const [list] = await Promise.all([refetchList(), detailsRunning ? refetchDetails() : undefined]);
      return list;
    } finally {
      // Cleared once the reloads have landed — resetting first would let the
      // walks re-run against the pages still in the cache and stall again on
      // the very state this reload replaces.
      //
      // In `finally` rather than after the await: both queries set
      // `errorPolicy: 'all'`, so `refetch` resolves with the error attached
      // instead of rejecting, and this cannot throw today. It would if either
      // query ever dropped that policy, and a reload that failed without
      // releasing the walks would leave a stale warning no later reload could
      // clear.
      resetListWalk();
      resetDetailWalk();
    }
  }, [refetchList, refetchDetails, detailsRunning, resetListWalk, resetDetailWalk]);

  // Memoised for the same reason the page memoises its mapping: a fresh Map
  // each render would defeat the caller's useMemo and re-map every row.
  const details = useMemo(() => proposalDetailsById(detailData), [detailData]);

  // A detail failure must not read as "Live data" with a zero Time column: a
  // reviewer could accept an award against an estimate that never loaded. The
  // list's own error is separate — it blanks the table — so both are reported.
  //
  // Two ways to fail, and `errorPolicy: 'all'` means neither is the common one:
  // the first request returned nothing, or a later page of the walk was
  // rejected. A per-observation ITC warning is neither — it arrives alongside a
  // complete result and must stay benign (sc-10153).
  //
  // A walk that gave up did not finish, so the Time column is short and must
  // say so rather than read as live.
  //
  // A stalled *list* walk counts too, and is the worse case: a page that never
  // arrived takes whole proposals with it, so the table is short rather than
  // merely missing a Time column. Settling on what we have is right; presenting
  // it as the complete list is not.
  const detailsFailed =
    listStalledAt !== undefined ||
    detailStalledAt !== undefined ||
    (detailResult.error !== undefined && detailData === undefined);

  // Settled once the ODB reports no more pages. Deliberately not
  // `hasMore ?? true`: a detail query that errors with no data never reports
  // `hasMore` at all, and the tab would spin for ever. Deliberately not a row
  // count either — a program deleted between the two queries returns no row,
  // so comparing rows against ids asked for would never settle.
  const detailsComplete = detailsFailed || (detailData !== undefined && !detailData.programs.hasMore);

  const detailsPending = specialIds.length > 0 && (detailResult.loading || !detailsComplete);

  return {
    ...result,
    details,
    // `refetch` alone would refresh the list and leave the details showing
    // pre-mutation estimates, so callers get one that reloads both.
    refetch: refetchAll,
    // Surfaced separately from `error` so the view can say the estimates are
    // missing while still showing the rows the list returned.
    detailsFailed,
    // Distinguishes the two shapes of incompleteness for the view: a short
    // proposal list is not the same as a complete list whose Time column is
    // missing, and the reader has to be told which one they are looking at.
    listTruncated: listStalledAt !== undefined,
    // Not settled until every list page is in and the details for them have
    // landed, so callers never map a partial set.
    loading: result.loading || !listSettled || detailsPending,
  };
}

export const SET_PROPOSAL_STATUS_MUTATION = graphql(`
  mutation AdminSetProposalStatus($programId: ProgramId!, $status: ProposalStatus!) {
    setProposalStatus(input: { programId: $programId, status: $status }) {
      program {
        id
      }
    }
  }
`);

/** Semester token of a proposal reference ("G-2027B-0123" → "2027B"); "—"
 *  for internal-id fallbacks that carry no semester. */
export function semesterOfReference(reference: string): string {
  const m = /-(\d{4}[AB])/.exec(reference);
  return m ? m[1]! : '—';
}

export function useSetProposalStatus() {
  return useMutation(SET_PROPOSAL_STATUS_MUTATION);
}
