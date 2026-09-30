import { describe, expect, it } from 'vitest';

import { fakeJwt, standardUser } from '@/test/factories';
import { type MockedResponseOf, renderWithContext } from '@/test/render';

import type { ConflictRow } from './conflicts';
import { CONFLICT_TARGETS_QUERY, conflictTargetLabel, useConflictTargetNames } from './conflicts';

const STAFF_TOKEN = fakeJwt(standardUser('staff'));

/** A conflict row; only the fields the target lookup reads matter here. */
function row(overrides: Partial<ConflictRow> = {}): ConflictRow {
  return {
    sourceId: 'x-1',
    key: 'x-1:p-1:x-9',
    programLabel: 'G-2027B-0057-Q',
    detailLabel: 'x-9',
    programId: 'p-1',
    requestId: 'x-9',
    status: 'Requested',
    target: '—',
    applicableObservations: [],
    ra: '01:02:03.000',
    dec: '-30:00:00.00',
    raDeg: 15.5,
    decDeg: -30,
    modeType: 'GMOS_SOUTH_LONG_SLIT',
    sepArcsec: 1,
    ...overrides,
  };
}

/** `name: null` stands for an observation with no science target at all — the
 *  schema makes a target's own name non-null, so that is the only way a name
 *  can be missing. */
const targets = (
  ids: readonly string[],
  matches: { id: string; name: string | null }[],
): MockedResponseOf<typeof CONFLICT_TARGETS_QUERY> => ({
  request: { query: CONFLICT_TARGETS_QUERY, variables: { ids: [...ids] } },
  result: {
    data: {
      observations: {
        __typename: 'ObservationSelectResult',
        matches: matches.map((m) => ({
          __typename: 'Observation' as const,
          id: m.id,
          targetEnvironment: {
            __typename: 'TargetEnvironment' as const,
            firstScienceTarget:
              m.name === null ? null : { __typename: 'Target' as const, id: `t-${m.id}`, name: m.name },
          },
        })),
      },
    },
  },
});

/** Renders what the hook resolved, so a missing query shows up as empty text
 *  rather than as a silent no-op. */
function Harness({ rows }: { readonly rows: readonly ConflictRow[] }) {
  const byId = useConflictTargetNames(rows);
  return (
    <div>
      <span data-testid="names">{rows.map((r) => conflictTargetLabel(r, byId)).join(' | ')}</span>
      <span data-testid="count">{String(byId.size)}</span>
    </div>
  );
}

/** A second consumer whose ids do resolve; waiting on it proves the mock link
 *  has finished answering before the skip assertion runs. Uses an id no other
 *  test asks for, so its cached result cannot bleed into theirs. */
const BARRIER_ID = 'o-barrier';

function Barrier() {
  const byId = useConflictTargetNames([row({ applicableObservations: [BARRIER_ID] })]);
  return <span data-testid="probe">{byId.get(BARRIER_ID) ?? ''}</span>;
}

describe(useConflictTargetNames, () => {
  it('resolves the target names of a request’s applicable observations', async () => {
    const screen = await renderWithContext(<Harness rows={[row({ applicableObservations: ['o-1', 'o-2'] })]} />, {
      token: STAFF_TOKEN,
      mocks: [
        targets(
          ['o-1', 'o-2'],
          [
            { id: 'o-1', name: 'NGC 300' },
            { id: 'o-2', name: 'NGC 300' },
          ],
        ),
      ],
    });

    // Both observations name the same target, so it is listed once.
    await expect.element(screen.getByTestId('names')).toHaveTextContent('NGC 300');
  });

  it('asks for each observation once, in a stable order, however the rows repeat them', async () => {
    // The mock matches on exact variables, so it only resolves if the hook
    // de-duplicates and sorts the ids — otherwise no name ever appears.
    const screen = await renderWithContext(
      <Harness
        rows={[
          row({ applicableObservations: ['o-2', 'o-1'] }),
          row({ sourceId: 'x-2', key: 'x-2:p-1:x-9', applicableObservations: ['o-1'] }),
        ]}
      />,
      {
        token: STAFF_TOKEN,
        mocks: [
          targets(
            ['o-1', 'o-2'],
            [
              { id: 'o-1', name: 'M31' },
              { id: 'o-2', name: 'M32' },
            ],
          ),
        ],
      },
    );

    await expect.element(screen.getByTestId('count')).toHaveTextContent('2');
  });

  it('does not query at all when no row has applicable observations (ToO rows carry their own name)', async () => {
    // An unmatched query fails quietly in Apollo's mock link, so asserting on
    // what renders cannot tell a skipped query from a failed one. Instead, mock
    // the empty-id query and have it answer with a name: the hook must never
    // reach it, so that name must not appear and the map must stay empty. A
    // query for an empty id list asks the ODB for nothing on every render.
    const screen = await renderWithContext(
      <>
        <Harness rows={[row({ applicableObservations: [], target: 'Vega' })]} />
        <Barrier />
      </>,
      {
        token: STAFF_TOKEN,
        mocks: [
          // Answers the empty-id query with a row, so a hook that queries anyway
          // lands a name in its map and pushes `count` above zero.
          targets([], [{ id: 'o-never', name: 'SHOULD NOT BE FETCHED' }]),
          targets([BARRIER_ID], [{ id: BARRIER_ID, name: 'M31' }]),
        ],
      },
    );

    await expect.element(screen.getByTestId('names')).toHaveTextContent('Vega');
    // A second harness whose ids DO resolve settles only once the mock link has
    // answered, so by the time it shows a name any wrongly-issued empty query
    // has also come back — making the assertion below a real check rather than
    // one that passes simply by running first.
    await expect.element(screen.getByTestId('probe')).toHaveTextContent('M31');
    expect(screen.getByTestId('count').element().textContent).toBe('0');
  });

  it('falls back to a dash when a request’s observations name no target', async () => {
    // `target` is deliberately a real name here: a request resolves its label
    // from its observations, so an unnamed one must read "—" rather than fall
    // back to the row's own (meaningless, for a request) target field.
    const screen = await renderWithContext(
      <Harness rows={[row({ applicableObservations: ['o-3'], target: 'Vega' })]} />,
      {
        token: STAFF_TOKEN,
        mocks: [targets(['o-3'], [{ id: 'o-3', name: null }])],
      },
    );

    await expect.element(screen.getByTestId('names')).toHaveTextContent('—');
    // An unnamed observation must not reach the map at all: a `undefined` value
    // would make ReadonlyMap<string, string> a lie and inflate the size.
    await expect.element(screen.getByTestId('count')).toHaveTextContent('0');
  });

  it('lists distinct names separated by commas, dropping ones that never resolve', async () => {
    // Two different names exercise the join separator, and a null-named
    // observation alongside them exercises the filter — neither is reachable
    // when every observation shares one name.
    const screen = await renderWithContext(
      <Harness rows={[row({ applicableObservations: ['o-1', 'o-2', 'o-3'] })]} />,
      {
        token: STAFF_TOKEN,
        mocks: [
          targets(
            ['o-1', 'o-2', 'o-3'],
            [
              { id: 'o-1', name: 'M31' },
              { id: 'o-2', name: 'M32' },
              { id: 'o-3', name: null },
            ],
          ),
        ],
      },
    );

    await expect.element(screen.getByTestId('names')).toHaveTextContent('M31, M32');
  });
});
