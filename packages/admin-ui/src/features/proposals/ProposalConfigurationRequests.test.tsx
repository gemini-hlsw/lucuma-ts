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
function Harness({
  decided: initial = false,
  locked = false,
}: {
  readonly decided?: boolean;
  readonly locked?: boolean;
}) {
  const proposalRequests = useProposalRequests('p-1');
  const [decided, setDecided] = useState(initial);
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
      <button onClick={() => setDecided(true)}>decide</button>
      <output data-testid="declined">{[...declined].sort().join(',')}</output>
    </>
  );
}

const render = (mocks: readonly MockLink.MockedResponse[], decided = false, locked = false) =>
  renderWithContext(<Harness decided={decided} locked={locked} />, { token: STAFF_TOKEN, mocks });

describe(ProposalConfigurationRequests, () => {
  it('shows the proposal’s requests', async () => {
    const screen = await render([requestsMock([configurationRequest('x-9')]), observationsMock()]);
    await expect.element(screen.getByText('Configuration Requests')).toBeVisible();
    await expect.element(screen.getByText('x-9')).toBeVisible();
  });

  it('renders nothing for a proposal with no requests', async () => {
    const screen = await render([requestsMock([]), observationsMock()]);
    await expect.element(screen.getByText('Configuration Requests')).not.toBeInTheDocument();
  });

  it('starts all pending requests ticked and records unticked ones as declined', async () => {
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

  it('keeps each column’s cells in place when the proposal becomes decided', async () => {
    const screen = await render([requestsMock([configurationRequest('x-1')]), observationsMock()]);
    await expect.poll(() => ticks(screen)).toEqual([true]);
    await userEvent.click(screen.getByRole('button', { name: 'decide' }));
    await expect.poll(() => rowBoxes(screen).length).toBe(0);
    await expect.element(screen.getByTitle('Pending')).toBeInTheDocument();
    const headers = [...screen.container.querySelectorAll('.cr-review-table thead th')].map((th) => th.textContent);
    const cells = [...screen.container.querySelectorAll('.cr-review-table tbody tr:first-child td')];
    expect(cells[headers.indexOf('Received')]?.textContent).toBe('2027-06-01 12:30 UTC');
    expect(cells[headers.indexOf('Target')]?.textContent).not.toBe('2027-06-01 12:30 UTC');
  });

  it('is read-only once the proposal is decided', async () => {
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
    // Each outcome shows as its status dot.
    await expect.element(screen.getByTitle('Approved')).toBeVisible();
    await expect.element(screen.getByTitle('Denied')).toBeVisible();
  });

  it('locks the ticks while a resolve is in flight', async () => {
    const screen = await render(
      [requestsMock([configurationRequest('x-1'), configurationRequest('x-2')]), observationsMock()],
      false,
      true,
    );
    await expect.poll(() => ticks(screen)).toEqual([true, true]);
    expect(rowBoxes(screen).map((box) => box.disabled)).toEqual([true, true]);
  });

  it('does not offer a withdrawn request', async () => {
    const screen = await render([
      requestsMock([configurationRequest('x-1'), configurationRequest('x-2', 'WITHDRAWN')]),
      observationsMock(),
    ]);
    await expect.poll(() => ticks(screen)).toEqual([true, false]);
    expect(rowBoxes(screen).map((box) => box.disabled)).toEqual([false, true]);
  });

  it('says so when the requests fail to load', async () => {
    const failing: MockedResponseOf<typeof PROGRAM_CONFIGURATION_REQUESTS_QUERY> = {
      request: { query: PROGRAM_CONFIGURATION_REQUESTS_QUERY, variables: { programId: 'p-1', offset: null } },
      error: new Error('ODB unavailable'),
    };
    const screen = await render([failing, observationsMock()]);
    await expect.element(screen.getByText(/Could not load this proposal’s configuration requests/)).toBeVisible();
  });

  it('says so when a later page fails to load', async () => {
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

  it('says so, and stops asking, when the page walk stalls', async () => {
    // A cursor answered with itself and hasMore stalls the walk (sc-10723).
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
    // One answer per cursor, so asking again fails the test.
    const screen = await render([page(null), page('x-9'), observationsMock()]);
    await expect.element(screen.getByText(/Could not load this proposal’s configuration requests\./)).toBeVisible();
  });

  it('says so when the observations cannot all be loaded', async () => {
    const obsPage = (offset: string | null, hasMore: boolean): MockedResponseOf<typeof PROGRAM_OBSERVATIONS_QUERY> => ({
      request: { query: PROGRAM_OBSERVATIONS_QUERY, variables: { programId: 'p-1', offset } },
      result: { data: { observations: { __typename: 'ObservationSelectResult', matches: [], hasMore } } },
    });
    // An empty page with hasMore leaves no cursor.
    const screen = await render([requestsMock([configurationRequest('x-9')]), obsPage(null, true)]);
    await expect
      .element(screen.getByText(/Could not load the program’s observations, so Target and Windows may be blank/))
      .toBeVisible();
  });
});
