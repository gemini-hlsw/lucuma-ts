import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import {
  CONFLICT_TARGETS_QUERY,
  type ConflictSource,
  type ObservationSource,
  type PositionedSource,
} from '@/gql/odb/conflicts';
import { searchRadiusArcsec } from '@/lib/geminiArchive';
import { baseMock, conflictMocks, coordinates, observationCandidate, requestCandidate } from '@/test/conflicts';
import { type MockedResponseOf, renderWithContext } from '@/test/render';

import { ConflictsTable } from './ConflictsTable';

const MODE = 'GMOS_SOUTH_LONG_SLIT';
const source: PositionedSource = { id: 'x-125', programId: 'p-1', raDeg: 30, decDeg: -30, modeType: MODE };

/** The cone's radius plus the measured 29.68″ epoch gap (t-14105): matched by the ODB,
 *  yet returned outside the radius. */
const RETURNED_OFFSET_DEG = (searchRadiusArcsec(MODE) + 29.68) / 3600;

/** A request whose returned position lies outside the cone the ODB matched it in. */
const outside = requestCandidate({
  configuration: {
    ...requestCandidate().configuration,
    target: { __typename: 'ConfigurationTarget', coordinates: coordinates(30, -30 - RETURNED_OFFSET_DEG) },
  },
});

const LINK = { name: 'G-2027B-0421-P' };

/** The target names of the requests' applicable observations, resolved in a second query. */
const targetNames = (ids: string[]): MockedResponseOf<typeof CONFLICT_TARGETS_QUERY> => ({
  request: { query: CONFLICT_TARGETS_QUERY, variables: { ids } },
  result: { data: { observations: { __typename: 'ObservationSelectResult', matches: [] } } },
});
const table = (sources: readonly (ConflictSource | ObservationSource)[]) => (
  <ConflictsTable title="Potential Conflicts" sources={sources} />
);
const ALL_CLEAR = /No conflicting plans found/;

describe(ConflictsTable, () => {
  it('lists a conflict whose returned position lies outside the cone, since the ODB judged proximity', async () => {
    const screen = await renderWithContext(table([source]), {
      mocks: conflictMocks(source, { requests: { matches: [outside] } }),
    });
    await expect.element(screen.getByRole('link', LINK)).toBeVisible();
    await expect.element(screen.getByText('194.7″')).toBeVisible();
    await expect.element(screen.getByRole('heading', { name: 'x-125' })).toBeVisible();
  });

  it('says so in one line, with no empty table, when a source has no conflicts', async () => {
    const screen = await renderWithContext(table([source]), { mocks: conflictMocks(source) });
    await expect.element(screen.getByText(ALL_CLEAR)).toBeVisible();
    expect(screen.getByRole('columnheader').elements()).toHaveLength(0);
  });

  it('shows a dash for the separation of a candidate whose position could not be read', async () => {
    const unplaced = requestCandidate({ configuration: { ...requestCandidate().configuration, target: null } });
    const screen = await renderWithContext(table([source]), {
      mocks: conflictMocks(source, { requests: { matches: [unplaced] } }),
    });
    await expect.element(screen.getByRole('link', LINK)).toBeVisible();
    await expect.element(screen.getByRole('columnheader', { name: 'Sep' })).toBeVisible();
    expect(screen.getByRole('cell', { name: '—' }).elements().length).toBeGreaterThan(0);
    expect(screen.getByText(/″/).elements()).toHaveLength(0);
  });

  it.each(['requests', 'observations'] as const)(
    'says so when the %s pool hit its limit, rather than reading as complete',
    async (pool) => {
      const screen = await renderWithContext(table([source]), {
        mocks: conflictMocks(source, { [pool]: { hasMore: true } }),
      });
      await expect.element(screen.getByText(/More candidates matched than this check can list/)).toBeVisible();
      await expect.element(screen.getByText(ALL_CLEAR)).not.toBeInTheDocument();
    },
  );

  it('reports a failed query and never an all-clear, even when the other pool answered', async () => {
    const [requests, observations] = conflictMocks(source, { requests: { matches: [requestCandidate()] } });
    const screen = await renderWithContext(table([source]), {
      mocks: [requests, { request: observations.request, error: new Error('ODB unavailable') }],
    });
    await expect.element(screen.getByText(/Conflict check failed/)).toBeVisible();
    await expect.element(screen.getByText(ALL_CLEAR)).not.toBeInTheDocument();
    await expect.element(screen.getByRole('link', LINK)).not.toBeInTheDocument();
  });

  it('fails the check on a GraphQL error, even when the response carries data', async () => {
    const [requests, observations] = conflictMocks(source, {
      requests: { matches: [requestCandidate()] },
      observations: { matches: [observationCandidate({ id: 'o-7' })] },
    });
    const { data } = observations.result as { data: object };
    const screen = await renderWithContext(table([source]), {
      mocks: [
        requests,
        {
          request: observations.request,
          result: { data, errors: [{ message: 'The ODB failed.', path: ['observations'] }] },
        },
      ],
    });
    await expect.element(screen.getByText(/Conflict check failed: The ODB failed/)).toBeVisible();
    expect(screen.getByText(ALL_CLEAR).elements()).toHaveLength(0);
    expect(screen.getByRole('link', LINK).elements()).toHaveLength(0);
  });

  it.each(['requests', 'observations'] as const)('shows the failure itself when the %s pool fails', async (pool) => {
    const [requests, observations] = conflictMocks(source);
    const failing = (mock: typeof requests | typeof observations) => ({
      request: mock.request,
      error: new Error('The pool is down'),
    });
    const screen = await renderWithContext(table([source]), {
      mocks: pool === 'requests' ? [failing(requests), observations] : [requests, failing(observations)],
    });
    await expect.element(screen.getByText(/The pool is down/)).toBeVisible();
  });

  describe.each(['requests', 'observations'] as const)('when the %s pool answers without data', (pool) => {
    it.each([
      ['no data', null],
      ['an empty result', {}],
    ])('treats %s as a failure, not as an empty pool', async (_, data) => {
      const [requests, observations] = conflictMocks(source);
      const broken = (mock: typeof requests | typeof observations) => ({ request: mock.request, result: { data } });
      const screen = await renderWithContext(table([source]), {
        mocks: pool === 'requests' ? [broken(requests), observations] : [requests, broken(observations)],
      });
      await expect.element(screen.getByText(/Conflict check failed/)).toBeVisible();
      await expect.element(screen.getByText(ALL_CLEAR)).not.toBeInTheDocument();
    });
  });

  it('lists an observation once when a request found for the same source already carries it', async () => {
    const screen = await renderWithContext(table([source]), {
      mocks: [
        ...conflictMocks(source, {
          requests: { matches: [requestCandidate({ applicableObservations: ['o-7'] })] },
          observations: { matches: [observationCandidate({ id: 'o-7' })] },
        }),
        targetNames(['o-7']),
      ],
    });
    await expect.element(screen.getByRole('link', LINK)).toBeVisible();
    expect(screen.getByRole('link', LINK).elements()).toHaveLength(1);
  });

  it('lists both when the observation is not one the request carries', async () => {
    const screen = await renderWithContext(table([source]), {
      mocks: [
        ...conflictMocks(source, {
          requests: { matches: [requestCandidate({ applicableObservations: ['o-other'] })] },
          observations: { matches: [observationCandidate({ id: 'o-7' })] },
        }),
        targetNames(['o-other']),
      ],
    });
    await expect.element(screen.getByRole('link', LINK).first()).toBeVisible();
    expect(screen.getByRole('link', LINK).elements()).toHaveLength(2);
  });

  describe('with several sources', () => {
    const three: PositionedSource[] = [0, 1, 2].map((i) => ({
      id: `x-${400 + i}`,
      programId: 'p-1',
      raDeg: 30 + i,
      decDeg: -30,
      modeType: MODE,
    }));
    /** The text of the section a source's heading opens. */
    const sectionOf = (screen: Awaited<ReturnType<typeof renderWithContext>>, id: string) =>
      screen.getByRole('heading', { name: id }).element().parentElement?.textContent ?? '';

    it('lists a conflict under the source whose cone found it, and no other', async () => {
      const screen = await renderWithContext(table(three), {
        mocks: three.flatMap((s) =>
          conflictMocks(s, s.id === 'x-402' ? { requests: { matches: [requestCandidate()] } } : {}),
        ),
      });
      await expect.element(screen.getByRole('link', LINK)).toBeVisible();
      expect(screen.getByRole('link', LINK).elements()).toHaveLength(1);
      expect(sectionOf(screen, 'x-402')).toContain('G-2027B-0421-P');
      await expect.poll(() => sectionOf(screen, 'x-400')).toMatch(ALL_CLEAR);
      await expect.poll(() => sectionOf(screen, 'x-401')).toMatch(ALL_CLEAR);
    });

    it('answers two sources that share one cone, each in its own section', async () => {
      const twin: PositionedSource = { ...source, id: 'x-126' };
      const screen = await renderWithContext(table([source, twin]), {
        mocks: conflictMocks(source, { requests: { matches: [requestCandidate()] } }),
      });
      await expect.element(screen.getByRole('heading', { name: 'x-125' })).toBeVisible();
      await expect.element(screen.getByRole('heading', { name: 'x-126' })).toBeVisible();
      await expect.poll(() => screen.getByRole('link', LINK).elements().length).toBe(2);
    });

    it('fails only the source whose operation failed, leaving the others’ answers on screen', async () => {
      const [requests, observations] = conflictMocks(three[0]!);
      const screen = await renderWithContext(table(three), {
        mocks: [
          requests,
          { request: observations.request, error: new Error('ODB unavailable') },
          ...conflictMocks(three[1]!),
          ...conflictMocks(three[2]!, { requests: { matches: [requestCandidate()] } }),
        ],
      });
      await expect.element(screen.getByText(/Conflict check failed/)).toBeVisible();
      await expect.element(screen.getByRole('link', LINK)).toBeVisible();
      await expect.poll(() => screen.getByText(/Conflict check failed/).elements().length).toBe(1);
    });

    it('keeps the answers of the sources that stay when one is deselected, without asking again', async () => {
      let asked = 0;
      const [requests, observations] = conflictMocks(three[1]!, { requests: { matches: [requestCandidate()] } });
      // Counted as each request is sent, so a re-ask is seen before its answer arrives.
      const counted = {
        ...requests,
        request: {
          ...requests.request,
          variables: (variables: object) => {
            const mine = JSON.stringify(variables) === JSON.stringify(requests.request.variables);
            if (mine) asked += 1;
            return mine;
          },
        },
      };
      function Selection() {
        const [sources, setSources] = useState<readonly PositionedSource[]>(three);
        return (
          <>
            <button onClick={() => setSources(three.slice(1))}>Deselect first</button>
            {table(sources)}
          </>
        );
      }
      const screen = await renderWithContext(<Selection />, {
        mocks: [...conflictMocks(three[0]!), counted, observations, ...conflictMocks(three[2]!)],
      });
      await expect.element(screen.getByRole('link', LINK)).toBeVisible();
      expect(asked).toBe(1);
      await screen.getByRole('button', { name: 'Deselect first' }).click();
      await expect.element(screen.getByRole('heading', { name: 'x-400' })).not.toBeInTheDocument();
      await expect.element(screen.getByRole('link', LINK)).toBeVisible();
      expect(asked).toBe(1);
    });
  });

  it('lists nothing from the old answer while the same source is checked afresh', async () => {
    // Moving the source changes its variables, so it is checked afresh.
    const moved: PositionedSource = { ...source, raDeg: 31 };
    function Moving() {
      const [at, setAt] = useState<ConflictSource>(source);
      return (
        <>
          <button onClick={() => setAt(moved)}>Move</button>
          {table([at])}
        </>
      );
    }
    const [requests, observations] = conflictMocks(source, { requests: { matches: [requestCandidate()] } });
    const [movedRequests, movedObservations] = conflictMocks(moved);
    const screen = await renderWithContext(<Moving />, {
      mocks: [requests, observations, { ...movedRequests, delay: 1000 }, movedObservations],
    });
    await expect.element(screen.getByRole('link', LINK)).toBeVisible();
    await screen.getByRole('button', { name: 'Move' }).click();
    await expect.element(screen.getByText(/Checking active programs/)).toBeVisible();
    expect(screen.getByRole('link', LINK).elements()).toHaveLength(0);
    expect(screen.getByText(ALL_CLEAR).elements()).toHaveLength(0);
    await expect.element(screen.getByText(ALL_CLEAR), { timeout: 4000 }).toBeVisible();
  });

  it('says when a source cannot be checked, with no section and no all-clear of its own', async () => {
    const unplaced: ConflictSource = { id: 'x-300', programId: 'p-1', raDeg: null, decDeg: null, modeType: MODE };
    const screen = await renderWithContext(table([source, unplaced]), { mocks: conflictMocks(source) });
    await expect
      .element(screen.getByText(/Not checked, for lack of a position or a similar observing mode: x-300/))
      .toBeVisible();
    await expect.element(screen.getByText(ALL_CLEAR)).toBeVisible();
    expect(screen.getByText(ALL_CLEAR).elements()).toHaveLength(1);
    expect(screen.getByRole('heading', { name: 'x-300' }).elements()).toHaveLength(0);
  });

  it('says there is nothing to check when there are no sources', async () => {
    const screen = await renderWithContext(table([]));
    await expect.element(screen.getByText('Nothing to check.')).toBeVisible();
  });

  describe('with an asterism under review', () => {
    const observed: ObservationSource = { id: 'o-125', programId: 'p-1', modeType: MODE, atBase: true };
    /** The ODB's base for the asterism, where its cone must be centred. */
    const base: PositionedSource = { ...source, id: 'o-125', raDeg: 40, decDeg: 10 };

    it('centres the cone on the base position the ODB computes', async () => {
      const screen = await renderWithContext(table([observed]), {
        mocks: [baseMock('o-125', [40, 10]), ...conflictMocks(base, { requests: { matches: [requestCandidate()] } })],
      });
      await expect.element(screen.getByRole('link', LINK)).toBeVisible();
    });

    it('says it is not checked when the ODB gives no base position', async () => {
      const screen = await renderWithContext(table([observed]), { mocks: [baseMock('o-125', null)] });
      await expect.element(screen.getByText('Not checked: no fixed base position.')).toBeVisible();
      expect(screen.getByText(ALL_CLEAR).elements()).toHaveLength(0);
    });

    it('says it is not checked when the observation is not found', async () => {
      const screen = await renderWithContext(table([observed]), {
        mocks: [{ request: baseMock('o-125', null).request, result: { data: { observation: null } } }],
      });
      await expect.element(screen.getByText('Not checked: observation not found.')).toBeVisible();
    });

    it('fails only its own check when its base position cannot be computed', async () => {
      const reason = 'Observation time is required to compute the asterism base position in observation o-125.';
      const screen = await renderWithContext(table([observed, source]), {
        mocks: [
          {
            request: baseMock('o-125', null).request,
            result: {
              data: null,
              errors: [{ message: reason, path: ['observation', 'targetEnvironment', 'basePosition'] }],
            },
          },
          ...conflictMocks(source, { requests: { matches: [requestCandidate()] } }),
        ],
      });
      await expect.element(screen.getByText(`Not checked: ${reason}`)).toBeVisible();
      await expect.element(screen.getByRole('link', LINK)).toBeVisible();
    });
  });
});
