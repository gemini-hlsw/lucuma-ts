import { describe, expect, it } from 'vitest';

import { fakeJwt, standardUser } from '@/test/factories';
import { type MockedResponseOf, renderWithContext } from '@/test/render';

import type { AdminProgramObservationsResult } from './changeRequests';
import { PROGRAM_OBSERVATIONS_QUERY, useProgramObservations } from './changeRequests';

const STAFF_TOKEN = fakeJwt(standardUser('staff'));

type ObservationMatch = AdminProgramObservationsResult['observations']['matches'][number];

/** A minimal ObservationItem match; only `id` matters for these tests. */
const obs = (id: string): ObservationMatch => ({
  __typename: 'Observation',
  id,
  observationDuration: null,
  instrument: 'GMOS_NORTH',
  observingMode: { __typename: 'ObservingMode', mode: 'GMOS_NORTH_LONG_SLIT' },
  constraintSet: {
    __typename: 'ConstraintSet',
    imageQuality: 'POINT_EIGHT',
    cloudExtinction: 'POINT_THREE',
    skyBackground: 'GRAY',
    waterVapor: 'WET',
  },
  targetEnvironment: { __typename: 'TargetEnvironment', firstScienceTarget: null },
});

const page = (
  offset: string | null,
  ids: string[],
  hasMore: boolean,
): MockedResponseOf<typeof PROGRAM_OBSERVATIONS_QUERY> => ({
  request: { query: PROGRAM_OBSERVATIONS_QUERY, variables: { programId: 'p-1', offset } },
  result: {
    data: { observations: { __typename: 'ObservationSelectResult', matches: ids.map(obs), hasMore } },
  },
});

/** Renders the ids the hook has accumulated, plus its loading flag. */
function Harness() {
  const { matches, loading } = useProgramObservations('p-1');
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="ids">{matches.map((m) => m.id).join(',')}</span>
    </div>
  );
}

describe('useProgramObservations', () => {
  it('follows hasMore across pages and accumulates every observation', async () => {
    const screen = await renderWithContext(<Harness />, {
      token: STAFF_TOKEN,
      // Page 1 (offset null) hasMore; page 2 (offset = last id of page 1) is the last.
      mocks: [page(null, ['o-1', 'o-2'], true), page('o-2', ['o-3', 'o-4'], false)],
    });
    // Once both pages are in, all four ids are present and loading has settled.
    await expect.element(screen.getByTestId('ids')).toHaveTextContent('o-1,o-2,o-3,o-4');
    await expect.element(screen.getByTestId('loading')).toHaveTextContent('false');
  });

  it('settles immediately when the first page is the last', async () => {
    const screen = await renderWithContext(<Harness />, {
      token: STAFF_TOKEN,
      mocks: [page(null, ['o-1'], false)],
    });
    await expect.element(screen.getByTestId('ids')).toHaveTextContent('o-1');
    await expect.element(screen.getByTestId('loading')).toHaveTextContent('false');
  });
});
