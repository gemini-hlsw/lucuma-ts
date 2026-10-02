import { GET_CONFIGURATION } from '@gql/configs/Configuration';
import { GET_OBSERVATIONS_BY_STATE } from '@gql/odb/Observation';
import type { MockedResponseOf } from '@gql/util';
import { page } from 'vitest/browser';

import { createConfiguration, createObservation } from '@/test/create';
import { renderWithContext } from '@/test/render';

import { ObservationTable } from './ObservationTable';

describe(ObservationTable, () => {
  const rowWithTitle = (title: string) => page.getByRole('row').filter({ hasText: title });

  it('should mark the observation that is loaded as current', async () => {
    await renderWithContext(
      <ObservationTable
        selectedObservation={null}
        setSelectedObservation={vi.fn()}
        onImport={vi.fn()}
        loading={false}
      />,
      { mocks: [getConfigurationMock, getObservationsMock] },
    );

    await expect.element(rowWithTitle('Second observation').getByText('Current', { exact: true })).toBeVisible();
    await expect
      .element(rowWithTitle('First observation').getByText('Current', { exact: true }))
      .not.toBeInTheDocument();
  });
});

const getConfigurationMock = {
  request: {
    query: GET_CONFIGURATION,
    variables: {},
  },
  result: {
    data: {
      configuration: createConfiguration({ obsId: 'o-2' }),
    },
  },
} satisfies MockedResponseOf<typeof GET_CONFIGURATION>;

const getObservationsMock = {
  request: {
    query: GET_OBSERVATIONS_BY_STATE,
    variables: () => true,
  },
  result: {
    data: {
      observations: {
        __typename: 'ObservationSelectResult',
        matches: [
          createObservation({
            id: 'o-1',
            title: 'First observation',
            reference: { label: 'G-2025B-0001-Q-0001', __typename: 'ObservationReference' },
          }),
          createObservation({
            id: 'o-2',
            title: 'Second observation',
            reference: { label: 'G-2025B-0001-Q-0002', __typename: 'ObservationReference' },
          }),
        ],
      },
    },
  },
} satisfies MockedResponseOf<typeof GET_OBSERVATIONS_BY_STATE>;
