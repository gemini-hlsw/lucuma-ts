import type { MockLink } from '@apollo/client/testing';
import { dateToLocalObservingNight } from '@gemini-hlsw/lucuma-core';
import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';

import {
  PROGRAM_CONFIGURATION_REQUESTS_QUERY,
  PROGRAM_OBSERVATIONS_QUERY,
  RESOLVE_WITH_FEEDBACK_MUTATION,
} from '@/gql/odb/changeRequests';
import { CONFLICTS_QUERY, similarModeTypes } from '@/gql/odb/conflicts';
import { fakeJwt, standardUser } from '@/test/factories';
import { type MockedResponseOf, renderWithContext } from '@/test/render';

import { ProposalConfigurationRequests } from './ProposalConfigurationRequests';

const STAFF_TOKEN = fakeJwt(standardUser('staff'));

const rawRequest = (status: 'REQUESTED' | 'APPROVED', justification = 'Please observe.') => ({
  __typename: 'ConfigurationRequest' as const,
  id: 'x-9',
  status,
  justification,
  feedback: null,
  createdAt: '2027-06-01T12:30:00Z',
  applicableObservations: [],
  program: {
    __typename: 'Program' as const,
    id: 'p-1',
    name: 'A proposal',
    reference: { __typename: 'ScienceProgramReference' as const, label: 'G-2027B-0042-DD' },
    pi: null,
  },
  configuration: {
    __typename: 'Configuration' as const,
    target: null,
    observingMode: {
      __typename: 'ConfigurationObservingMode' as const,
      instrument: 'GMOS_NORTH' as const,
      mode: 'GMOS_NORTH_LONG_SLIT' as const,
    },
    conditions: {
      __typename: 'ConfigurationConditions' as const,
      imageQuality: 'POINT_EIGHT' as const,
      cloudExtinction: 'POINT_THREE' as const,
      skyBackground: 'GRAY' as const,
      waterVapor: 'WET' as const,
    },
  },
});

const requestsMock = (
  matches: ReturnType<typeof rawRequest>[],
): MockedResponseOf<typeof PROGRAM_CONFIGURATION_REQUESTS_QUERY> => ({
  request: { query: PROGRAM_CONFIGURATION_REQUESTS_QUERY, variables: { programId: 'p-1', offset: null } },
  result: {
    data: { configurationRequests: { __typename: 'ConfigurationRequestSelectResult', matches, hasMore: false } },
  },
});

const observationsMock = (): MockedResponseOf<typeof PROGRAM_OBSERVATIONS_QUERY> => ({
  request: { query: PROGRAM_OBSERVATIONS_QUERY, variables: { programId: 'p-1', offset: null } },
  result: { data: { observations: { __typename: 'ObservationSelectResult', matches: [], hasMore: false } } },
  maxUsageCount: Infinity,
});

const emptyConflicts = (): MockedResponseOf<typeof CONFLICTS_QUERY> => ({
  request: {
    query: CONFLICTS_QUERY,
    variables: {
      modeTypes: [...similarModeTypes('GMOS_NORTH_LONG_SLIT')].sort(),
      today: dateToLocalObservingNight(new Date()),
    },
  },
  maxUsageCount: Infinity,
  result: {
    data: {
      configurationRequests: { __typename: 'ConfigurationRequestSelectResult', matches: [] },
      observations: { __typename: 'ObservationSelectResult', matches: [] },
    },
  },
});

const render = (mocks: readonly MockLink.MockedResponse[]) =>
  renderWithContext(<ProposalConfigurationRequests programId="p-1" programLabel="G-2027B-0042-DD" />, {
    token: STAFF_TOKEN,
    mocks,
  });

/** The decision a reviewer's Approve + Confirm sends: the seeded approval wording. */
const approveMock = (): MockedResponseOf<typeof RESOLVE_WITH_FEEDBACK_MUTATION> => {
  // The seeded approval boilerplate is what goes out as the PI response.
  const feedback =
    'Dear (unknown PI),\n\nThanks for submitting your proposal. The configurations you requested (x-9) have been approved.\n\nRegards,\nGemini Science Operations';
  const approve: MockedResponseOf<typeof RESOLVE_WITH_FEEDBACK_MUTATION> = {
    request: { query: RESOLVE_WITH_FEEDBACK_MUTATION, variables: { ids: ['x-9'], status: 'APPROVED', feedback } },
    result: {
      data: {
        updateConfigurationRequests: {
          __typename: 'UpdateConfigurationRequestsResult',
          requests: [{ __typename: 'ConfigurationRequest', id: 'x-9', status: 'APPROVED', feedback }],
        },
      },
    },
  };
  return approve;
};

describe(ProposalConfigurationRequests, () => {
  it('shows the proposal’s configuration requests for review', async () => {
    const screen = await render([requestsMock([rawRequest('REQUESTED')]), observationsMock()]);
    await expect.element(screen.getByText('Configuration Requests')).toBeVisible();
    await expect.element(screen.getByText('x-9')).toBeVisible();
  });

  it('renders nothing for a proposal with no requests', async () => {
    const screen = await render([requestsMock([]), observationsMock()]);
    await expect.element(screen.getByText('Configuration Requests')).not.toBeInTheDocument();
  });

  it('records a decision and reloads this program’s requests in place', async () => {
    // The second answer is what the post-resolve refetch returns. The mutation's
    // own response already updates the cached status, so the justification is
    // what tells a refetch of this program's query from no refetch at all.
    const screen = await render([
      requestsMock([rawRequest('REQUESTED')]),
      requestsMock([rawRequest('APPROVED', 'Reloaded from the ODB.')]),
      observationsMock(),
      emptyConflicts(),
      approveMock(),
    ]);

    // PrimeReact names both the cell wrapper and the input; click the input.
    await userEvent.click(screen.getByRole('checkbox', { name: 'Row Selected x-9' }).last());
    await userEvent.click(screen.getByRole('button', { name: 'Approve' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    await expect.element(screen.getByText('Reloaded from the ODB.')).toBeVisible();
    // A proposal's requests are configuration requests, not change requests.
    await expect.element(screen.getByText('Configuration requests approved')).toBeVisible();
  });

  it('says so when the requests fail to load, rather than reading as no requests', async () => {
    const failing: MockedResponseOf<typeof PROGRAM_CONFIGURATION_REQUESTS_QUERY> = {
      request: { query: PROGRAM_CONFIGURATION_REQUESTS_QUERY, variables: { programId: 'p-1', offset: null } },
      error: new Error('ODB unavailable'),
    };
    const screen = await render([failing, observationsMock()]);
    await expect.element(screen.getByText(/Could not load this proposal’s configuration requests/)).toBeVisible();
  });

  it('says so when a later page of requests fails to load, not showing a truncated list as complete', async () => {
    const firstPage: MockedResponseOf<typeof PROGRAM_CONFIGURATION_REQUESTS_QUERY> = {
      request: { query: PROGRAM_CONFIGURATION_REQUESTS_QUERY, variables: { programId: 'p-1', offset: null } },
      result: {
        data: {
          configurationRequests: {
            __typename: 'ConfigurationRequestSelectResult',
            matches: [rawRequest('REQUESTED')],
            hasMore: true,
          },
        },
      },
    };
    const secondPage: MockedResponseOf<typeof PROGRAM_CONFIGURATION_REQUESTS_QUERY> = {
      request: { query: PROGRAM_CONFIGURATION_REQUESTS_QUERY, variables: { programId: 'p-1', offset: 'x-9' } },
      error: new Error('ODB unavailable'),
    };
    const screen = await render([firstPage, secondPage, observationsMock()]);
    await expect.element(screen.getByText(/Could not load this proposal’s configuration requests/)).toBeVisible();
  });

  it('keeps the review on screen while the requests reload after a decision', async () => {
    // The reload is slow enough to be caught mid-flight.
    const slowReload = { ...requestsMock([rawRequest('APPROVED', 'Reloaded from the ODB.')]), delay: 300 };
    const screen = await render([
      requestsMock([rawRequest('REQUESTED')]),
      slowReload,
      observationsMock(),
      emptyConflicts(),
      approveMock(),
    ]);
    await expect.element(screen.getByText('Configuration Requests')).toBeVisible();

    let tornDown = false;
    const watch = new MutationObserver(() => {
      if (screen.container.querySelector('.review-obs-title') === null) tornDown = true;
    });
    watch.observe(screen.container, { childList: true, subtree: true });

    await userEvent.click(screen.getByRole('checkbox', { name: 'Row Selected x-9' }).last());
    await userEvent.click(screen.getByRole('button', { name: 'Approve' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    await expect.element(screen.getByText('Reloaded from the ODB.')).toBeVisible();

    watch.disconnect();
    expect(tornDown).toBe(false);
  });
});
