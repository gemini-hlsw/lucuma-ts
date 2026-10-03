import { dateToLocalObservingNight } from '@gemini-hlsw/lucuma-core';
import { describe, expect, it } from 'vitest';

import {
  type AdminConflictObservations,
  CONFLICT_OBSERVATIONS_QUERY,
  CONFLICT_REQUESTS_QUERY,
  similarModeTypes,
} from '@/gql/odb/conflicts';
import { searchRadiusArcsec } from '@/lib/geminiArchive';
import { type MockedResponseOf, renderWithContext } from '@/test/render';

import { ConflictsTable } from './ConflictsTable';

const MODE = 'GMOS_SOUTH_LONG_SLIT';
const source = { id: 'x-125', programId: 'p-1', raDeg: 30, decDeg: -30, modeType: MODE };

/** Both queries are keyed on the exact cone, mode list and date. A mock only
 *  answers a request whose variables equal these, so a cone with the wrong
 *  centre or radius never reaches the result — the table would render the
 *  "failed" state instead. The matching mock is the assertion. */
const variables = () => ({
  cones: [
    {
      targetCoordinates: {
        center: { ra: { degrees: 30 }, dec: { degrees: -30 } },
        distance: { arcseconds: searchRadiusArcsec(MODE) },
      },
    },
  ],
  modeTypes: [...similarModeTypes(MODE)],
  today: dateToLocalObservingNight(new Date()),
});

/** Where the conflict's returned position lies: the cone's radius plus 29.68″,
 *  the measured gap between a target's catalogue-epoch position and the J2000
 *  one the ODB matches on (target t-14105, sc-9243). The ODB judged it inside
 *  the cone, yet the coordinates it hands back sit outside the radius — so a
 *  client-side `separation <= radius` would drop this genuine conflict. */
const RETURNED_OFFSET_DEG = (searchRadiusArcsec(MODE) + 29.68) / 3600;

const requests = (
  hasMore = false,
  applicableObservations: string[] = [],
): MockedResponseOf<typeof CONFLICT_REQUESTS_QUERY> => ({
  request: { query: CONFLICT_REQUESTS_QUERY, variables: variables() },
  result: {
    data: {
      configurationRequests: {
        __typename: 'ConfigurationRequestSelectResult',
        hasMore,
        matches: [
          {
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
          },
        ],
      },
    },
  },
});

/** An observation of another program at the returned position of the request. */
const observation = (id: string): AdminConflictObservations['observations']['matches'][number] => ({
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

const observations = (
  hasMore = false,
  observationId?: string,
): MockedResponseOf<typeof CONFLICT_OBSERVATIONS_QUERY> => ({
  request: { query: CONFLICT_OBSERVATIONS_QUERY, variables: variables() },
  result: {
    data: {
      observations: {
        __typename: 'ObservationSelectResult',
        hasMore,
        matches: observationId === undefined ? [] : [observation(observationId)],
      },
    },
  },
});

describe(ConflictsTable, () => {
  it('asks the ODB for a cone of the mode’s radius and lists a conflict whose returned position lies outside it', async () => {
    const screen = await renderWithContext(<ConflictsTable title="Potential Conflicts" sources={[source]} />, {
      mocks: [requests(), observations()],
    });
    await expect.element(screen.getByRole('link', { name: 'G-2027B-0421-P' })).toBeVisible();
    await expect.element(screen.getByText('194.7″')).toBeVisible();
  });

  it('says so when a pool hit its limit, rather than reading as complete', async () => {
    const screen = await renderWithContext(<ConflictsTable title="Potential Conflicts" sources={[source]} />, {
      mocks: [requests(true), observations()],
    });
    await expect.element(screen.getByText(/More candidates matched than this check can list/)).toBeVisible();
  });

  it('reports a failed query and never an all-clear, even when the other pool answered', async () => {
    const failing: MockedResponseOf<typeof CONFLICT_OBSERVATIONS_QUERY> = {
      request: { query: CONFLICT_OBSERVATIONS_QUERY, variables: variables() },
      error: new Error('ODB unavailable'),
    };
    const screen = await renderWithContext(<ConflictsTable title="Potential Conflicts" sources={[source]} />, {
      mocks: [requests(), failing],
    });
    await expect.element(screen.getByText(/Conflict check failed/)).toBeVisible();
    await expect.element(screen.getByText(/could not be checked/)).toBeVisible();
    await expect.element(screen.getByRole('link', { name: 'G-2027B-0421-P' })).not.toBeInTheDocument();
  });

  it('says so when the observations pool hit its limit too', async () => {
    const screen = await renderWithContext(<ConflictsTable title="Potential Conflicts" sources={[source]} />, {
      mocks: [requests(), observations(true)],
    });
    await expect.element(screen.getByText(/More candidates matched than this check can list/)).toBeVisible();
  });

  it('treats a result with no data as a failure, not as an empty pool', async () => {
    const empty: MockedResponseOf<typeof CONFLICT_OBSERVATIONS_QUERY> = {
      request: { query: CONFLICT_OBSERVATIONS_QUERY, variables: variables() },
      result: { data: null },
    };
    const screen = await renderWithContext(<ConflictsTable title="Potential Conflicts" sources={[source]} />, {
      mocks: [requests(), empty],
    });
    await expect.element(screen.getByText(/Conflict check failed/)).toBeVisible();
  });

  it('lists an observation once when a request found for the same source already carries it', async () => {
    const screen = await renderWithContext(<ConflictsTable title="Potential Conflicts" sources={[source]} />, {
      mocks: [requests(false, ['o-7']), observations(false, 'o-7')],
    });
    await expect.element(screen.getByRole('link', { name: 'G-2027B-0421-P' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'G-2027B-0421-P' }).elements()).toHaveLength(1);
  });

  it('lists both when the observation is not one the request carries', async () => {
    const screen = await renderWithContext(<ConflictsTable title="Potential Conflicts" sources={[source]} />, {
      mocks: [requests(false, ['o-other']), observations(false, 'o-7')],
    });
    await expect.element(screen.getByRole('link', { name: 'G-2027B-0421-P' }).first()).toBeVisible();
    expect(screen.getByRole('link', { name: 'G-2027B-0421-P' }).elements()).toHaveLength(2);
  });
});
