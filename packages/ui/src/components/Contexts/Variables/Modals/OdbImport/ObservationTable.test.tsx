import { GET_CONFIGURATION } from '@gql/configs/Configuration';
import { GET_OBSERVATIONS_BY_STATE } from '@gql/odb/Observation';
import type { MockedResponseOf } from '@gql/util';
import { page } from 'vitest/browser';

import { createConfiguration, createObservation, createOdbObservationReference } from '@/test/create';
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

  it('should load every page of observations when the ODB reports more matches', async () => {
    await renderWithContext(
      <ObservationTable
        selectedObservation={null}
        setSelectedObservation={vi.fn()}
        onImport={vi.fn()}
        loading={false}
      />,
      { mocks: [getConfigurationMock, getFirstPageMock, getSecondPageMock] },
    );

    await expect.element(rowWithTitle('Third observation')).toBeVisible();
    await expect.element(rowWithTitle('First observation')).toBeVisible();
    await expect.element(rowWithTitle('Second observation')).toBeVisible();
  });

  it('should warn that the list is incomplete when a later page fails', async () => {
    await renderWithContext(
      <ObservationTable
        selectedObservation={null}
        setSelectedObservation={vi.fn()}
        onImport={vi.fn()}
        loading={false}
      />,
      { mocks: [getConfigurationMock, getFirstPageMock, getSecondPageErrorMock] },
    );

    await expect.element(page.getByText(/could not load every observation/i)).toBeVisible();
    await expect.element(rowWithTitle('First observation')).toBeVisible();
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
            reference: createOdbObservationReference({ label: 'G-2025B-0001-Q-0001' }),
          }),
          createObservation({
            id: 'o-2',
            title: 'Second observation',
            reference: createOdbObservationReference({ label: 'G-2025B-0001-Q-0002' }),
          }),
        ],
        hasMore: false,
      },
    },
  },
} satisfies MockedResponseOf<typeof GET_OBSERVATIONS_BY_STATE>;

const getFirstPageMock = {
  request: {
    query: GET_OBSERVATIONS_BY_STATE,
    variables: (vars) => !vars.offset,
  },
  result: {
    data: {
      observations: {
        __typename: 'ObservationSelectResult',
        matches: [
          createObservation({ id: 'o-1', title: 'First observation' }),
          createObservation({ id: 'o-2', title: 'Second observation' }),
        ],
        hasMore: true,
      },
    },
  },
} satisfies MockedResponseOf<typeof GET_OBSERVATIONS_BY_STATE>;

const getSecondPageMock = {
  request: {
    query: GET_OBSERVATIONS_BY_STATE,
    variables: (vars) => vars.offset === 'o-2',
  },
  result: {
    data: {
      observations: {
        __typename: 'ObservationSelectResult',
        matches: [createObservation({ id: 'o-3', title: 'Third observation' })],
        hasMore: false,
      },
    },
  },
} satisfies MockedResponseOf<typeof GET_OBSERVATIONS_BY_STATE>;

const getSecondPageErrorMock = {
  request: getSecondPageMock.request,
  error: new Error('ODB unavailable'),
} satisfies MockedResponseOf<typeof GET_OBSERVATIONS_BY_STATE>;
