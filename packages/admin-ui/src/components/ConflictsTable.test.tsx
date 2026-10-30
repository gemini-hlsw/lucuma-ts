import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { CONFLICT_TARGETS_QUERY, type ConflictSource, type PositionedSource } from '@/gql/odb/conflicts';
import type { ConflictObservationCandidateFragment, ConflictRequestCandidateFragment } from '@/gql/odb/gen/graphql';
import { searchRadiusArcsec } from '@/lib/geminiArchive';
import { conflictMocks } from '@/test/conflicts';
import { type MockedResponseOf, renderWithContext } from '@/test/render';

import { ConflictsTable } from './ConflictsTable';

const MODE = 'GMOS_SOUTH_LONG_SLIT';
const source: PositionedSource = { id: 'x-125', programId: 'p-1', raDeg: 30, decDeg: -30, modeType: MODE };

/** Where the conflict's returned position lies: the cone's radius plus 29.68″,
 *  the measured gap between a target's catalogue-epoch position and the J2000
 *  one the ODB matches on (target t-14105, sc-9243). The ODB judged it inside
 *  the cone, yet the coordinates it hands back sit outside the radius — so a
 *  client-side `separation <= radius` would drop this genuine conflict. */
const RETURNED_OFFSET_DEG = (searchRadiusArcsec(MODE) + 29.68) / 3600;

const request = (applicableObservations: string[] = []): ConflictRequestCandidateFragment => ({
  __typename: 'ConfigurationRequest',
  id: 'x-42',
  status: 'APPROVED',
  applicableObservations,
  program: {
    __typename: 'Program',
    id: 'p-2',
    reference: { __typename: 'ScienceProgramReference', label: 'G-2027B-0421-P' },
  },
  configuration: {
    __typename: 'Configuration',
    target: {
      __typename: 'ConfigurationTarget',
      coordinates: {
        __typename: 'Coordinates',
        ra: { __typename: 'RightAscension', degrees: 30 },
        dec: { __typename: 'Declination', degrees: -30 - RETURNED_OFFSET_DEG },
      },
    },
    observingMode: { __typename: 'ConfigurationObservingMode', mode: MODE },
  },
});

/** An observation of another program at the returned position of the request. */
const observation = (id: string): ConflictObservationCandidateFragment => ({
  __typename: 'Observation',
  id,
  reference: { __typename: 'ObservationReference', label: 'G-2027B-0421-P-0001' },
  workflow: {
    __typename: 'CalculatedObservationWorkflow',
    value: { __typename: 'ObservationWorkflow', state: 'READY' },
  },
  observingMode: { __typename: 'ObservingMode', mode: MODE },
  program: {
    __typename: 'Program',
    id: 'p-2',
    reference: { __typename: 'ScienceProgramReference', label: 'G-2027B-0421-P' },
  },
  targetEnvironment: {
    __typename: 'TargetEnvironment',
    basePosition: {
      __typename: 'BasePosition',
      name: 'Target',
      sidereal: {
        __typename: 'Sidereal',
        ra: { __typename: 'RightAscension', degrees: 30 },
        dec: { __typename: 'Declination', degrees: -30 - RETURNED_OFFSET_DEG },
      },
      coordinates: null,
    },
  },
});

const LINK = { name: 'G-2027B-0421-P' };

/** The target names of the requests' applicable observations, resolved in a second query. */
const targetNames = (ids: string[]): MockedResponseOf<typeof CONFLICT_TARGETS_QUERY> => ({
  request: { query: CONFLICT_TARGETS_QUERY, variables: { ids } },
  result: { data: { observations: { __typename: 'ObservationSelectResult', matches: [] } } },
});
const table = (sources: readonly ConflictSource[]) => <ConflictsTable title="Potential Conflicts" sources={sources} />;
const ALL_CLEAR = /No conflicting plans found/;

describe(ConflictsTable, () => {
  it('lists a conflict whose returned position lies outside the cone, since the ODB judged proximity', async () => {
    const screen = await renderWithContext(table([source]), {
      mocks: conflictMocks(source, { requests: { matches: [request()] } }),
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
    const unplaced = { ...request(), configuration: { ...request().configuration, target: null } };
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
    const [requests, observations] = conflictMocks(source, { requests: { matches: [request()] } });
    const screen = await renderWithContext(table([source]), {
      mocks: [requests, { request: observations.request, error: new Error('ODB unavailable') }],
    });
    await expect.element(screen.getByText(/Conflict check failed/)).toBeVisible();
    await expect.element(screen.getByText(ALL_CLEAR)).not.toBeInTheDocument();
    await expect.element(screen.getByRole('link', LINK)).not.toBeInTheDocument();
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
          requests: { matches: [request(['o-7'])] },
          observations: { matches: [observation('o-7')] },
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
          requests: { matches: [request(['o-other'])] },
          observations: { matches: [observation('o-7')] },
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
        mocks: three.flatMap((s) => conflictMocks(s, s.id === 'x-402' ? { requests: { matches: [request()] } } : {})),
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
        mocks: conflictMocks(source, { requests: { matches: [request()] } }),
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
          ...conflictMocks(three[2]!, { requests: { matches: [request()] } }),
        ],
      });
      await expect.element(screen.getByText(/Conflict check failed/)).toBeVisible();
      await expect.element(screen.getByRole('link', LINK)).toBeVisible();
      await expect.poll(() => screen.getByText(/Conflict check failed/).elements().length).toBe(1);
    });

    it('keeps the answers of the sources that stay when one is deselected, without asking again', async () => {
      let asked = 0;
      const [requests, observations] = conflictMocks(three[1]!, { requests: { matches: [request()] } });
      const counted = {
        ...requests,
        result: () => {
          asked += 1;
          return requests.result as { data: object };
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

  it('lists nothing while one pool is still answering, since half an answer is not the whole', async () => {
    let requestsAnswered = false;
    const [requests, observations] = conflictMocks(source, { requests: { matches: [request()] } });
    const screen = await renderWithContext(table([source]), {
      mocks: [
        {
          ...requests,
          result: () => {
            requestsAnswered = true;
            return requests.result as { data: object };
          },
        },
        { ...observations, delay: 1200 },
      ],
    });
    // The requests pool has answered with its conflict; the observations pool has not.
    await vi.waitFor(() => expect(requestsAnswered).toBe(true));
    await new Promise((resolve) => setTimeout(resolve, 100));
    await expect.element(screen.getByText(/Checking active programs/)).toBeVisible();
    expect(screen.getByRole('link', LINK).elements()).toHaveLength(0);
    expect(screen.getByText(ALL_CLEAR).elements()).toHaveLength(0);
    expect(screen.getByText(/Conflict check failed/).elements()).toHaveLength(0);
    await expect.element(screen.getByRole('link', LINK), { timeout: 4000 }).toBeVisible();
  });

  it('lists nothing from the old answer while the same source is checked afresh', async () => {
    // A source that moves, as the observing-night boundary moves `today`, changes the variables.
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
    const [requests, observations] = conflictMocks(source, { requests: { matches: [request()] } });
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

  it('shows no section, and never an all-clear, when no source can be checked', async () => {
    const unplaced: ConflictSource = { id: 'x-300', programId: 'p-1', raDeg: null, decDeg: null, modeType: MODE };
    const screen = await renderWithContext(table([unplaced]), { mocks: [] });
    await expect
      .element(screen.getByText(/Not checked, for lack of a position or a similar observing mode: x-300/))
      .toBeVisible();
    await expect.element(screen.getByText(ALL_CLEAR)).not.toBeInTheDocument();
  });

  it('says when a source has no position or similar mode to check, rather than reading as clear', async () => {
    const unplaced: ConflictSource = { id: 'x-300', programId: 'p-1', raDeg: null, decDeg: null, modeType: MODE };
    const screen = await renderWithContext(table([source, unplaced]), {
      mocks: conflictMocks(source),
    });
    await expect
      .element(screen.getByText(/Not checked, for lack of a position or a similar observing mode: x-300/))
      .toBeVisible();
  });
});
