import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';

import { executionDigest, fakeJwt, standardUser } from '@/test/factories';
import { type MockedResponseOf, renderWithContext } from '@/test/render';

import { PROGRAM_OBSERVATIONS_QUERY, useProgramObservations } from './changeRequests';
import type { ObservationItemFragment } from './gen/graphql';

const STAFF_TOKEN = fakeJwt(standardUser('staff'));

/** A minimal ObservationItem match; only `id` matters for these tests. */
const obs = (id: string): ObservationItemFragment => ({
  __typename: 'Observation',
  id,
  calibrationRole: null,
  groupId: null,
  execution: executionDigest(null),
  instrument: 'GMOS_NORTH',
  observingMode: { __typename: 'ObservingMode', mode: 'GMOS_NORTH_LONG_SLIT' },
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

const page = (
  offset: string | null,
  ids: string[],
  hasMore: boolean,
  programId = 'p-1',
): MockedResponseOf<typeof PROGRAM_OBSERVATIONS_QUERY> => ({
  request: { query: PROGRAM_OBSERVATIONS_QUERY, variables: { programId, offset } },
  result: {
    data: { observations: { __typename: 'ObservationSelectResult', matches: ids.map(obs), hasMore } },
  },
});

/** Renders the ids the hook has accumulated, plus its loading flag. */
function Harness({ programId = 'p-1' }: { programId?: string | null }) {
  const { matches, loading, incomplete } = useProgramObservations(programId);
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="incomplete">{String(incomplete)}</span>
      <span data-testid="ids">{matches.map((m) => m.id).join(',')}</span>
    </div>
  );
}

describe(useProgramObservations, () => {
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

  it('asks for nothing, and reports nothing loading, while no program is selected', async () => {
    // No mocks: a request here would have nothing to answer it.
    const screen = await renderWithContext(<Harness programId={null} />, { token: STAFF_TOKEN, mocks: [] });
    await expect.element(screen.getByTestId('loading')).toHaveTextContent('false');
    await expect.element(screen.getByTestId('ids')).toHaveTextContent('');
  });

  it('walks a program again after another program was shown in between', async () => {
    function Switcher() {
      const [programId, setProgramId] = useState('p-1');
      return (
        <>
          <button type="button" onClick={() => setProgramId('p-2')}>
            other
          </button>
          <button type="button" onClick={() => setProgramId('p-1')}>
            back
          </button>
          <Harness programId={programId} />
        </>
      );
    }
    const screen = await renderWithContext(<Switcher />, {
      token: STAFF_TOKEN,
      mocks: [
        page(null, ['o-1', 'o-2'], true),
        { ...page('o-2', [], false), error: new Error('timed out') },
        page(null, ['o-9'], false, 'p-2'),
        page('o-2', ['o-3'], false),
      ],
    });
    await expect.element(screen.getByTestId('incomplete')).toHaveTextContent('true');
    await userEvent.click(screen.getByRole('button', { name: 'other' }));
    await expect.element(screen.getByTestId('ids')).toHaveTextContent('o-9');
    await userEvent.click(screen.getByRole('button', { name: 'back' }));
    // The first program's second page failed once; coming back to it asks again.
    await expect.element(screen.getByTestId('ids')).toHaveTextContent('o-1,o-2,o-3');
    await expect.element(screen.getByTestId('incomplete')).toHaveTextContent('false');
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
