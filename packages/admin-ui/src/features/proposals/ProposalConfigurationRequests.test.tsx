import type { MockLink } from '@apollo/client/testing';
import { fakeJwt, standardUser } from '@gemini-hlsw/lucuma-common-ui/testing';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';

import { PROGRAM_CONFIGURATION_REQUESTS_QUERY, PROGRAM_OBSERVATIONS_QUERY } from '@/gql/odb/changeRequests';
import { configurationRequest } from '@/test/factories';
import { type MockedResponseOf, renderWithContext } from '@/test/render';
import { boxOf, rowBoxes, ticks } from '@/test/requestTable';

import { ProposalConfigurationRequests } from './ProposalConfigurationRequests';
import { useProposalRequests } from './useProposalRequests';

const STAFF_TOKEN = fakeJwt(standardUser('staff'));

const requestsMock = (
  matches: ReturnType<typeof configurationRequest>[],
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

/** The component as the page drives it: the real loading hook, and the unticked ids held by the caller. */
function Harness({ decided = false, locked = false }: { readonly decided?: boolean; readonly locked?: boolean }) {
  const proposalRequests = useProposalRequests('p-1');
  const [declined, setDeclined] = useState<ReadonlySet<string>>(new Set());
  return (
    <>
      <ProposalConfigurationRequests
        programId="p-1"
        proposalRequests={proposalRequests}
        declined={declined}
        onDeclinedChange={setDeclined}
        decided={decided}
        locked={locked}
      />
      <output data-testid="declined">{[...declined].sort().join(',')}</output>
    </>
  );
}

const render = (mocks: readonly MockLink.MockedResponse[], decided = false, locked = false) =>
  renderWithContext(<Harness decided={decided} locked={locked} />, { token: STAFF_TOKEN, mocks });

describe(ProposalConfigurationRequests, () => {
  it('shows the proposal’s configuration requests for review', async () => {
    const screen = await render([requestsMock([configurationRequest('x-9')]), observationsMock()]);
    await expect.element(screen.getByText('Configuration Requests')).toBeVisible();
    await expect.element(screen.getByText('x-9')).toBeVisible();
  });

  it('renders nothing for a proposal with no requests', async () => {
    const screen = await render([requestsMock([]), observationsMock()]);
    await expect.element(screen.getByText('Configuration Requests')).not.toBeInTheDocument();
  });

  it('ticks every pending request to start with, and unticking one records it as declined', async () => {
    const screen = await render([
      requestsMock([configurationRequest('x-1'), configurationRequest('x-2')]),
      observationsMock(),
    ]);
    await expect.poll(() => ticks(screen)).toEqual([true, true]);
    await expect.element(screen.getByTestId('declined')).toHaveTextContent('');

    await userEvent.click(boxOf(screen, 'x-2'));
    await expect.poll(() => ticks(screen)).toEqual([true, false]);
    await expect.element(screen.getByTestId('declined')).toHaveTextContent('x-2');

    await userEvent.click(boxOf(screen, 'x-2'));
    await expect.poll(() => ticks(screen)).toEqual([true, true]);
    await expect.element(screen.getByTestId('declined')).toHaveTextContent('');
  });

  it('offers no ticking once the proposal has its decision, and shows each request’s outcome', async () => {
    const screen = await render(
      [
        requestsMock([configurationRequest('x-1', 'APPROVED'), configurationRequest('x-2', 'DENIED')]),
        observationsMock(),
      ],
      true,
    );
    await expect.element(screen.getByText('x-1')).toBeVisible();
    await expect.element(screen.getByRole('checkbox')).not.toBeInTheDocument();
    await expect.element(screen.getByText('Tick the requests to approve')).not.toBeInTheDocument();
    // The outcome of each request stays visible as its status dot.
    await expect.element(screen.getByTitle('Approved')).toBeVisible();
    await expect.element(screen.getByTitle('Denied')).toBeVisible();
  });

  it('keeps the ticks as they are while a resolve is in flight', async () => {
    const screen = await render(
      [requestsMock([configurationRequest('x-1'), configurationRequest('x-2')]), observationsMock()],
      false,
      true,
    );
    await expect.poll(() => ticks(screen)).toEqual([true, true]);
    expect(rowBoxes(screen).map((box) => box.disabled)).toEqual([true, true]);
  });

  it('does not offer a withdrawn request for ticking', async () => {
    const screen = await render([
      requestsMock([configurationRequest('x-1'), configurationRequest('x-2', 'WITHDRAWN')]),
      observationsMock(),
    ]);
    await expect.poll(() => ticks(screen)).toEqual([true, false]);
    expect(rowBoxes(screen).map((box) => box.disabled)).toEqual([false, true]);
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
            matches: [configurationRequest('x-9')],
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

  it('says so, and stops asking, when a page of requests repeats and the walk cannot move on', async () => {
    // The ODB can answer a cursor with a page that ends on the cursor itself and still say hasMore (sc-10723).
    const page = (offset: string | null): MockedResponseOf<typeof PROGRAM_CONFIGURATION_REQUESTS_QUERY> => ({
      request: { query: PROGRAM_CONFIGURATION_REQUESTS_QUERY, variables: { programId: 'p-1', offset } },
      result: {
        data: {
          configurationRequests: {
            __typename: 'ConfigurationRequestSelectResult',
            matches: [configurationRequest('x-9')],
            hasMore: true,
          },
        },
      },
    });
    // One answer for each cursor: a walk that asked again would meet "no more mocked responses" and fail the test.
    const screen = await render([page(null), page('x-9'), observationsMock()]);
    await expect.element(screen.getByText(/Could not load this proposal’s configuration requests\./)).toBeVisible();
  });

  it('says so when the observations that name Target and Windows cannot all be loaded', async () => {
    const obsPage = (offset: string | null, hasMore: boolean): MockedResponseOf<typeof PROGRAM_OBSERVATIONS_QUERY> => ({
      request: { query: PROGRAM_OBSERVATIONS_QUERY, variables: { programId: 'p-1', offset } },
      result: { data: { observations: { __typename: 'ObservationSelectResult', matches: [], hasMore } } },
    });
    // A first page with no rows that claims more leaves the walk no cursor to ask from.
    const screen = await render([requestsMock([configurationRequest('x-9')]), obsPage(null, true)]);
    await expect
      .element(screen.getByText(/Could not load the program’s observations, so Target and Windows may be blank/))
      .toBeVisible();
  });
});
