import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';

import { executionDigest, fakeJwt, standardUser } from '@/test/factories';
import { type MockedResponseOf, renderWithContext } from '@/test/render';

import type { ObservationItemFragment } from './gen/graphql';
import type { AdminProposalsResult } from './proposals';
import { mapProposals, PROPOSAL_DETAILS_QUERY, PROPOSALS_QUERY, useProposals } from './proposals';

const STAFF_TOKEN = fakeJwt(standardUser('staff'));

type RawProgram = AdminProposalsResult['programs']['matches'][number];

/** A minimal Director's Time program match; only `id` matters for these tests. */
const dd = (id: string): RawProgram => ({
  __typename: 'Program',
  id,
  name: null,
  description: null,
  proposalStatus: 'SUBMITTED',
  pi: null,
  proposal: {
    __typename: 'Proposal',
    reference: null,
    gemini: { __typename: 'DirectorsTime', scienceSubtype: 'DIRECTORS_TIME' },
  },
});

/** A program with an ordinary (non-special) proposal. The Proposals view never
 *  shows it, and — the point of the split — the detail query must never ask for
 *  it: these are the programs whose time estimates made the tab time out. */
const queue = (id: string): RawProgram => ({
  ...dd(id),
  proposal: {
    __typename: 'Proposal',
    reference: null,
    gemini: { __typename: 'Queue', scienceSubtype: 'QUEUE' },
  },
});

/** A program carrying no proposal at all — most of the server. */
const none = (id: string): RawProgram => ({ ...dd(id), proposal: null });

const page = (
  offset: string | null,
  matches: RawProgram[],
  hasMore: boolean,
): MockedResponseOf<typeof PROPOSALS_QUERY> => ({
  request: { query: PROPOSALS_QUERY, variables: { offset } },
  result: { data: { programs: { __typename: 'ProgramSelectResult', matches, hasMore } } },
});

/** One observation, so a row that got its details is distinguishable from one
 *  that did not — an empty fixture would let a broken split pass. */
const obs = (id: string): ObservationItemFragment => ({
  __typename: 'Observation',
  id,
  calibrationRole: null,
  groupId: null,
  execution: executionDigest(0.25),
  instrument: 'GMOS_NORTH',
  observingMode: null,
  constraintSet: {
    __typename: 'ConstraintSet',
    imageQuality: 'POINT_EIGHT',
    cloudExtinction: 'POINT_THREE',
    skyBackground: 'GRAY',
    waterVapor: 'WET',
  },
  schedulingConstraints: { __typename: 'SchedulingConstraints', timingWindows: [] },
  targetEnvironment: { __typename: 'TargetEnvironment', firstScienceTarget: null },
});

/** The follow-up query the hook fires once every list page is in (sc-10520).
 *  Keyed on the exact id list and offset, so an ask for the wrong ids — or one
 *  that never fires — leaves the mock unmatched and the observations missing. */
const details = (
  ids: string[],
  { offset = null, hasMore = false, only = ids }: { offset?: string | null; hasMore?: boolean; only?: string[] } = {},
): MockedResponseOf<typeof PROPOSAL_DETAILS_QUERY> => ({
  request: { query: PROPOSAL_DETAILS_QUERY, variables: { programIds: ids, offset } },
  result: {
    data: {
      programs: {
        __typename: 'ProgramSelectResult',
        hasMore,
        matches: only.map((id) => ({
          __typename: 'Program' as const,
          id,
          observations: { __typename: 'ObservationSelectResult' as const, matches: [obs(`o-${id}`)] },
          allGroupElements: [],
        })),
      },
    },
  },
});

/** Renders the ids the hook walked, its loading flag, and — the part only the
 *  detail query can supply — how many observations each mapped row carries. */
function Harness() {
  const { data, details, loading, detailsFailed, refetch } = useProposals();
  const ids = data?.programs.matches.map((m) => m.id).join(',') ?? '';
  const mapped = data ? mapProposals(data, details) : [];
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="failed">{String(detailsFailed)}</span>

      <span data-testid="ids">{ids}</span>
      <span data-testid="obs">{mapped.map((p) => `${p.id}:${p.observations.length}`).join(',')}</span>
      <button type="button" onClick={() => void refetch()}>
        refetch
      </button>
    </div>
  );
}

describe(useProposals, () => {
  it('follows hasMore so a special proposal past the first page is never dropped (sc-9589)', async () => {
    const screen = await renderWithContext(<Harness />, {
      token: STAFF_TOKEN,
      // The special-type filter runs client-side, so every program page must be
      // fetched — a Director's Time proposal on page 2 (p-new) must still appear.
      mocks: [
        page(null, [dd('p-1'), dd('p-2')], true),
        page('p-2', [dd('p-3'), dd('p-new')], false),
        details(['p-1', 'p-2', 'p-3', 'p-new']),
      ],
    });
    await expect.element(screen.getByTestId('ids')).toHaveTextContent('p-1,p-2,p-3,p-new');
    await expect.element(screen.getByTestId('loading')).toHaveTextContent('false');
    // Every walked program got its observations — the detail query asked for
    // the complete id set, not just the first page's.
    await expect.element(screen.getByTestId('obs')).toHaveTextContent('p-1:1,p-2:1,p-3:1,p-new:1');
  });

  it('walks the detail pages so a special proposal past the first is never left blank', async () => {
    // The ODB caps a page however it likes, so `IN` is not a page size. Before
    // this walk the overflow rendered with an empty Time column and no error.
    const screen = await renderWithContext(<Harness />, {
      token: STAFF_TOKEN,
      mocks: [
        page(null, [dd('p-1'), dd('p-2')], false),
        details(['p-1', 'p-2'], { hasMore: true, only: ['p-1'] }),
        details(['p-1', 'p-2'], { offset: 'p-1', only: ['p-2'] }),
      ],
    });
    await expect.element(screen.getByTestId('obs')).toHaveTextContent('p-1:1,p-2:1');
    await expect.element(screen.getByTestId('loading')).toHaveTextContent('false');
  });

  it('asks for time estimates ONLY for special proposals (the sc-10520 guard)', async () => {
    // This is the whole story: the old query asked for `execution.digest` and
    // `allGroupElements` across every program on the server and exceeded the
    // 30s request limit (measured: 30.5s against 851 dev programs), so the tab
    // died with "The ODB is unreachable".
    //
    // The detail mock below is keyed on the exact id list ['p-dd']. If the
    // `specialIds` filter is removed the hook asks for all four ids, no mock
    // matches, no observations arrive, and the `obs` assertion fails. Verified
    // by deleting the filter: this test goes red.
    const screen = await renderWithContext(<Harness />, {
      token: STAFF_TOKEN,
      mocks: [page(null, [queue('p-q1'), dd('p-dd'), none('p-n1'), queue('p-q2')], false), details(['p-dd'])],
    });
    await expect.element(screen.getByTestId('ids')).toHaveTextContent('p-q1,p-dd,p-n1,p-q2');
    // Only the Director's Time program is mapped, and it has its estimate.
    await expect.element(screen.getByTestId('obs')).toHaveTextContent('p-dd:1');
    await expect.element(screen.getByTestId('loading')).toHaveTextContent('false');
  });

  it('skips the detail query entirely when no proposal is special', async () => {
    // No special proposals means no second request at all — not an empty one.
    // A detail mock is deliberately absent: firing one would leave it
    // unmatched and error the render.
    const screen = await renderWithContext(<Harness />, {
      token: STAFF_TOKEN,
      mocks: [page(null, [queue('p-q1'), none('p-n1')], false)],
    });
    await expect.element(screen.getByTestId('loading')).toHaveTextContent('false');
    await expect.element(screen.getByTestId('obs')).toHaveTextContent('');
  });

  it('settles — and reports the failure — when the detail query errors', async () => {
    // `hasMore ?? true` could not tell "not loaded yet" from "never will be",
    // so a failed detail query left the tab spinning for ever. It must settle,
    // keep the list's rows, and say the estimates are missing.
    const screen = await renderWithContext(<Harness />, {
      token: STAFF_TOKEN,
      mocks: [
        page(null, [dd('p-1')], false),
        {
          request: { query: PROPOSAL_DETAILS_QUERY, variables: { programIds: ['p-1'], offset: null } },
          error: new Error('boom'),
        },
      ],
    });
    await expect.element(screen.getByTestId('loading')).toHaveTextContent('false');
    // The row survives; only its Time column is empty.
    await expect.element(screen.getByTestId('obs')).toHaveTextContent('p-1:0');
    await expect.element(screen.getByTestId('failed')).toHaveTextContent('true');
  });

  it('keeps one row per program when the inclusive cursor repeats one', async () => {
    // The ODB's OFFSET is inclusive (Predicates.program.id.gtEql), so every
    // page after the first repeats the previous page's last row.
    const screen = await renderWithContext(<Harness />, {
      token: STAFF_TOKEN,
      mocks: [
        page(null, [dd('p-1'), dd('p-2')], true),
        // p-2 comes back again as the first row of page 2.
        page('p-2', [dd('p-2'), dd('p-3')], false),
        details(['p-1', 'p-2', 'p-3']),
      ],
    });
    await expect.element(screen.getByTestId('ids')).toHaveTextContent('p-1,p-2,p-3');
    await expect.element(screen.getByTestId('obs')).toHaveTextContent('p-1:1,p-2:1,p-3:1');
  });

  it('does not stall when a requested program returns no detail row', async () => {
    // A program can vanish between the list and the detail query (deleted, or
    // no longer readable). The detail response then carries fewer rows than
    // ids asked for. Indexing the next chunk by rows-received rather than
    // ids-consumed would re-request ids already held and never reach the tail,
    // leaving `loading` true for ever.
    const screen = await renderWithContext(<Harness />, {
      token: STAFF_TOKEN,
      mocks: [
        page(null, [dd('p-1'), dd('p-2')], false),
        // p-2 is asked for but comes back missing.
        details(['p-1', 'p-2'], { only: ['p-1'] }),
      ],
    });
    await expect.element(screen.getByTestId('loading')).toHaveTextContent('false');
    await expect.element(screen.getByTestId('obs')).toHaveTextContent('p-1:1,p-2:0');
  });

  it('reports a failure when a later detail page dies mid-walk', async () => {
    // errorPolicy 'all' means a walk can stop partway holding real rows. The
    // first page arrived, the second failed, so the Time column is short —
    // that must read as a failure, not as "Live data" over incomplete rows.
    const screen = await renderWithContext(<Harness />, {
      token: STAFF_TOKEN,
      mocks: [
        page(null, [dd('p-midwalk-a'), dd('p-midwalk-b')], false),
        details(['p-midwalk-a', 'p-midwalk-b'], { hasMore: true, only: ['p-midwalk-a'] }),
        {
          request: {
            query: PROPOSAL_DETAILS_QUERY,
            variables: { programIds: ['p-midwalk-a', 'p-midwalk-b'], offset: 'p-midwalk-a' },
          },
          error: new Error('the ODB stopped answering'),
        },
      ],
    });
    await expect.element(screen.getByTestId('loading')).toHaveTextContent('false');
    await expect.element(screen.getByTestId('failed')).toHaveTextContent('true');
    // The page that did arrive is kept — a mid-walk failure must not blank it.
    await expect.element(screen.getByTestId('obs')).toHaveTextContent('p-midwalk-a:1,p-midwalk-b:0');
  });

  // Each walk test below uses its own program ids on purpose. The Apollo client
  // is shared across renders in this file, so a test that deliberately leaves a
  // walk stalled would otherwise hand its cached `hasMore: true` page to the
  // next one and the walk would never run.
  it('clears a previous walk failure once a refetch succeeds', async () => {
    // A failed walk must not brand the tab for the rest of the session: after
    // the user accepts a proposal the page refetches, and if that succeeds the
    // estimates really are there. Leaving the warning up would have a reviewer
    // distrust numbers that are correct.
    const screen = await renderWithContext(<Harness />, {
      token: STAFF_TOKEN,
      mocks: [
        page(null, [dd('p-refetch-a'), dd('p-refetch-b')], false),
        details(['p-refetch-a', 'p-refetch-b'], { hasMore: true, only: ['p-refetch-a'] }),
        {
          request: {
            query: PROPOSAL_DETAILS_QUERY,
            variables: { programIds: ['p-refetch-a', 'p-refetch-b'], offset: 'p-refetch-a' },
          },
          error: new Error('the ODB stopped answering'),
        },
        // The refetch: the list comes back, and this time the first detail page
        // is complete, so the walk has nothing left to resume. Supplying a
        // second page here instead would be ambiguous — two entries keyed on
        // the same variables, and which one MockedProvider hands back depends
        // on timing.
        page(null, [dd('p-refetch-a'), dd('p-refetch-b')], false),
        details(['p-refetch-a', 'p-refetch-b']),
      ],
    });
    // Wait for the walk to have actually given up before refetching: asserting
    // on `failed` alone would race the rejection, and clicking mid-flight tests
    // nothing about recovery.
    await expect.element(screen.getByTestId('loading')).toHaveTextContent('false');
    await expect.element(screen.getByTestId('failed')).toHaveTextContent('true');
    await expect.element(screen.getByTestId('obs')).toHaveTextContent('p-refetch-a:1,p-refetch-b:0');

    await userEvent.click(screen.getByRole('button', { name: 'refetch' }));

    await expect.element(screen.getByTestId('obs')).toHaveTextContent('p-refetch-a:1,p-refetch-b:1');
    await expect.element(screen.getByTestId('failed')).toHaveTextContent('false');
  });

  it('stops instead of re-requesting a page that did not advance the cursor', async () => {
    // Under errorPolicy 'all' a page can resolve carrying errors and no new
    // rows while still reporting hasMore. The cursor then points at the same
    // row as before, and without the equality guard the walk re-requests that
    // page for ever — an unbounded stream of live requests, not merely a stall.
    // One mock for the repeat is enough: a second attempt exhausts it and the
    // render errors, which is what makes this test discriminate.
    const screen = await renderWithContext(<Harness />, {
      token: STAFF_TOKEN,
      mocks: [
        page(null, [dd('p-1'), dd('p-2')], false),
        details(['p-1', 'p-2'], { hasMore: true, only: ['p-1'] }),
        // Page two answers with no new rows and still claims hasMore.
        details(['p-1', 'p-2'], { offset: 'p-1', hasMore: true, only: [] }),
      ],
    });
    await expect.element(screen.getByTestId('loading')).toHaveTextContent('false');
    await expect.element(screen.getByTestId('failed')).toHaveTextContent('true');
    await expect.element(screen.getByTestId('obs')).toHaveTextContent('p-1:1,p-2:0');
  });

  it('settles when the LIST walk dies partway instead of spinning for ever', async () => {
    // The list walk has the same exposure as the detail one: a rejected
    // `fetchMore` never reaches the query's `error`, so `listSettled` would
    // stay false, the detail query would never start, and the tab would spin
    // with no error shown. It must settle on what it has.
    const screen = await renderWithContext(<Harness />, {
      token: STAFF_TOKEN,
      mocks: [
        page(null, [dd('p-listwalk-a'), dd('p-listwalk-b')], true),
        {
          request: { query: PROPOSALS_QUERY, variables: { offset: 'p-listwalk-b' } },
          error: new Error('the ODB stopped answering'),
        },
        // The detail query still runs, for the programs the list did return.
        details(['p-listwalk-a', 'p-listwalk-b']),
      ],
    });
    await expect.element(screen.getByTestId('loading')).toHaveTextContent('false');
    await expect.element(screen.getByTestId('ids')).toHaveTextContent('p-listwalk-a,p-listwalk-b');
    await expect.element(screen.getByTestId('obs')).toHaveTextContent('p-listwalk-a:1,p-listwalk-b:1');
  });

  it('keeps an ITC warning benign when the rows arrived with it — sc-10153', async () => {
    // `errorPolicy: 'all'` exists so one un-costable observation cannot blank
    // the tab: the ODB answers with the rows AND an `errors` entry. That is not
    // a failure, and reporting it as one would undo sc-10153.
    const screen = await renderWithContext(<Harness />, {
      token: STAFF_TOKEN,
      mocks: [
        page(null, [dd('p-itc-a')], false),
        {
          request: { query: PROPOSAL_DETAILS_QUERY, variables: { programIds: ['p-itc-a'], offset: null } },
          result: {
            data: {
              programs: {
                __typename: 'ProgramSelectResult' as const,
                hasMore: false,
                matches: [
                  {
                    __typename: 'Program' as const,
                    id: 'p-itc-a',
                    observations: {
                      __typename: 'ObservationSelectResult' as const,
                      matches: [obs('o-p-itc-a')],
                    },
                    allGroupElements: [],
                  },
                ],
              },
            },
            errors: [{ message: "ITC returned errors: Target 't-1': Gaussian FWHM of 0.1 or greater." }],
          },
        },
      ],
    });
    await expect.element(screen.getByTestId('loading')).toHaveTextContent('false');
    // The rows are live data, warning and all.
    await expect.element(screen.getByTestId('failed')).toHaveTextContent('false');
    await expect.element(screen.getByTestId('obs')).toHaveTextContent('p-itc-a:1');
  });

  it('is stalled by a first page that claims more rows but carries none', async () => {
    // `hasMore` with an empty page leaves no cursor to page from at all, so the
    // walk can never advance — distinct from a page that answers empty, which
    // is caught on the response.
    const screen = await renderWithContext(<Harness />, {
      token: STAFF_TOKEN,
      mocks: [page(null, [dd('p-empty-a')], false), details(['p-empty-a'], { hasMore: true, only: [] })],
    });
    await expect.element(screen.getByTestId('loading')).toHaveTextContent('false');
    await expect.element(screen.getByTestId('failed')).toHaveTextContent('true');
  });

  it('reports a truncated list rather than presenting it as complete', async () => {
    // A list page that dies takes whole proposals with it — a Director's Time
    // proposal on the lost page simply is not there. Settling is right; doing
    // so silently is not, because the reader cannot tell a short list from a
    // complete one.
    const screen = await renderWithContext(<Harness />, {
      token: STAFF_TOKEN,
      mocks: [
        page(null, [dd('p-trunc-a')], true),
        {
          request: { query: PROPOSALS_QUERY, variables: { offset: 'p-trunc-a' } },
          error: new Error('the ODB stopped answering'),
        },
        details(['p-trunc-a']),
      ],
    });
    await expect.element(screen.getByTestId('loading')).toHaveTextContent('false');
    // The rows that did arrive are kept...
    await expect.element(screen.getByTestId('obs')).toHaveTextContent('p-trunc-a:1');
    // ...but the tab must say the list is short.
    await expect.element(screen.getByTestId('failed')).toHaveTextContent('true');
  });

  it('resumes the list walk after a refetch instead of stopping on the old page', async () => {
    // The first walk ends on a page that adds nothing. The reload then returns
    // a page 1 that still reports more, so the walk has to run again from the
    // cursor it already used — which it can only do if the refetch released it.
    // p-late-c exists only on the reloaded page 2, so it is the proof.
    const screen = await renderWithContext(<Harness />, {
      token: STAFF_TOKEN,
      mocks: [
        page(null, [dd('p-late-a')], true),
        // Page 2 of the first walk: no new programs, and it ends the walk.
        page('p-late-a', [dd('p-late-a')], false),
        // The reload's page 1, still reporting more.
        page(null, [dd('p-late-a')], true),
        // The reloaded page 2, carrying a program the first walk never saw.
        page('p-late-a', [dd('p-late-a'), dd('p-late-c')], false),
        details(['p-late-a']),
        details(['p-late-a', 'p-late-c']),
      ],
    });
    // Wait for the first walk to finish before reloading: clicking mid-flight
    // would race the in-flight page and make this test's outcome a coin toss.
    await expect.element(screen.getByTestId('loading')).toHaveTextContent('false');
    await expect.element(screen.getByTestId('ids')).toHaveTextContent('p-late-a');

    await userEvent.click(screen.getByRole('button', { name: 'refetch' }));

    // p-late-c must arrive. If the reload left the walk wedged, it never does.
    await expect.element(screen.getByTestId('ids')).toHaveTextContent('p-late-a,p-late-c');
  });

  it('settles immediately when the first page is the last', async () => {
    const screen = await renderWithContext(<Harness />, {
      token: STAFF_TOKEN,
      mocks: [page(null, [dd('p-1')], false), details(['p-1'])],
    });
    await expect.element(screen.getByTestId('ids')).toHaveTextContent('p-1');
    await expect.element(screen.getByTestId('obs')).toHaveTextContent('p-1:1');
    await expect.element(screen.getByTestId('loading')).toHaveTextContent('false');
  });
});
