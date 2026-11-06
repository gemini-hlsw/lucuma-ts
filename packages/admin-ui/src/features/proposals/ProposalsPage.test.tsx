import type { MockLink } from '@apollo/client/testing';
import { fakeJwt, standardUser } from '@gemini-hlsw/lucuma-common-ui/testing';
import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';

import {
  PROGRAM_CONFIGURATION_REQUESTS_QUERY,
  PROGRAM_OBSERVATIONS_QUERY,
  RESOLVE_PROPOSAL_REQUESTS_MUTATION,
} from '@/gql/odb/changeRequests';
import { UPDATE_PROGRAM_MUTATION } from '@/gql/odb/programs';
import { PROPOSALS_QUERY, SET_PROPOSAL_STATUS_MUTATION } from '@/gql/odb/proposals';
import { configurationRequest, emptyRoster } from '@/test/factories';
import { type MockedResponseOf, renderWithContext } from '@/test/render';
import { boxOf, rowBoxes } from '@/test/requestTable';

import ProposalsPage from './ProposalsPage';

const STAFF_TOKEN = fakeJwt(standardUser('staff'));

const proposalsMock = (status: 'SUBMITTED' | 'ACCEPTED' = 'SUBMITTED'): MockedResponseOf<typeof PROPOSALS_QUERY> => ({
  request: { query: PROPOSALS_QUERY, variables: { offset: null } },
  // Accepting reloads the list.
  maxUsageCount: Infinity,
  result: {
    data: {
      programs: {
        __typename: 'ProgramSelectResult',
        hasMore: false,
        matches: [
          {
            __typename: 'Program',
            id: 'p-1',
            name: 'A snap of a supernova',
            description: 'Time-critical imaging of a new SN.',
            proposalStatus: status,
            pi: {
              __typename: 'ProgramUser',
              id: 'm-1',
              user: {
                __typename: 'User',
                id: 'u-1',
                profile: { __typename: 'UserProfile', givenName: 'Grace', familyName: 'Hopper' },
              },
            },
            proposal: {
              __typename: 'Proposal',
              reference: { __typename: 'ProposalReference', label: 'G-2027B-0042' },
              gemini: { __typename: 'DirectorsTime', scienceSubtype: 'DIRECTORS_TIME' },
            },
            observations: { __typename: 'ObservationSelectResult', matches: [] },
            allGroupElements: [],
          },
        ],
      },
    },
  },
});

const requestsAnswer = (
  matches: ReturnType<typeof configurationRequest>[],
): MockedResponseOf<typeof PROGRAM_CONFIGURATION_REQUESTS_QUERY> => ({
  request: { query: PROGRAM_CONFIGURATION_REQUESTS_QUERY, variables: { programId: 'p-1', offset: null } },
  // Accepting reloads this program's requests.
  maxUsageCount: Infinity,
  result: {
    data: { configurationRequests: { __typename: 'ConfigurationRequestSelectResult', matches, hasMore: false } },
  },
});

const observationsAnswer = (): MockedResponseOf<typeof PROGRAM_OBSERVATIONS_QUERY> => ({
  request: { query: PROGRAM_OBSERVATIONS_QUERY, variables: { programId: 'p-1', offset: null } },
  result: { data: { observations: { __typename: 'ObservationSelectResult', matches: [], hasMore: false } } },
});

/** ProposalsPage as staff, with `proposals` as the answer to its list query. The page auto-selects the first
 *  proposal, so its detail queries answer with `requests` (none by default) and no observations. */
const renderPageWith = (
  proposals: MockedResponseOf<typeof PROPOSALS_QUERY>,
  requests: MockedResponseOf<typeof PROGRAM_CONFIGURATION_REQUESTS_QUERY> = requestsAnswer([]),
  ...more: MockLink.MockedResponse[]
) =>
  renderWithContext(<ProposalsPage />, {
    token: STAFF_TOKEN,
    mocks: [proposals, requests, observationsAnswer(), emptyRoster(), ...more],
  });

const renderPage = (
  requests?: MockedResponseOf<typeof PROGRAM_CONFIGURATION_REQUESTS_QUERY>,
  ...more: MockLink.MockedResponse[]
) => renderPageWith(proposalsMock(), requests, ...more);

const setStatusMock = (status: 'ACCEPTED' | 'NOT_ACCEPTED'): MockedResponseOf<typeof SET_PROPOSAL_STATUS_MUTATION> => ({
  request: { query: SET_PROPOSAL_STATUS_MUTATION, variables: { programId: 'p-1', status } },
  result: {
    data: {
      setProposalStatus: { __typename: 'SetProposalStatusResult', program: { __typename: 'Program', id: 'p-1' } },
    },
  },
});

const updateProgramMock = (): MockedResponseOf<typeof UPDATE_PROGRAM_MUTATION> => ({
  request: { query: UPDATE_PROGRAM_MUTATION, variables: { programId: 'p-1', set: { goa: { proprietaryMonths: 12 } } } },
  result: {
    data: { updatePrograms: { __typename: 'UpdateProgramsResult', programs: [{ __typename: 'Program', id: 'p-1' }] } },
  },
});

const resolveRequestsMock = (
  approved: string[],
  denied: string[],
): MockedResponseOf<typeof RESOLVE_PROPOSAL_REQUESTS_MUTATION> => {
  const outcome = (ids: string[], status: 'APPROVED' | 'DENIED') => ({
    __typename: 'UpdateConfigurationRequestsResult' as const,
    requests: ids.map((id) => ({ __typename: 'ConfigurationRequest' as const, id, status, feedback: null })),
  });
  return {
    request: { query: RESOLVE_PROPOSAL_REQUESTS_MUTATION, variables: { approved, denied } },
    result: {
      data: {
        approved: outcome(approved, 'APPROVED'),
        denied: outcome(denied, 'DENIED'),
      },
    },
  };
};

describe(ProposalsPage, () => {
  it('lists special proposals with the master-list columns', async () => {
    const screen = await renderPage();
    await expect.element(screen.getByText('Proposals', { exact: true })).toBeInTheDocument();
    for (const h of ['Reference', 'Semester', 'PI', 'Type', 'Status', 'Title']) {
      await expect.element(screen.getByText(h, { exact: true })).toBeInTheDocument();
    }
    await expect.element(screen.getByRole('cell', { name: 'G-2027B-0042' })).toBeInTheDocument();
    await expect.element(screen.getByRole('cell', { name: 'Grace Hopper' })).toBeInTheDocument();
  });

  it('offers status / type / semester facet dropdowns instead of a resolved toggle', async () => {
    const screen = await renderPage();
    await expect.element(screen.getByText('All statuses').first()).toBeInTheDocument();
    await expect.element(screen.getByText('All types').first()).toBeInTheDocument();
    await expect.element(screen.getByText('All semesters').first()).toBeInTheDocument();
    await expect.element(screen.getByText('Unresolved')).not.toBeInTheDocument();
  });

  it('leaves nothing selected when the selected row is deselected — sc-10137', async () => {
    const screen = await renderPage();
    const row = screen.getByRole('cell', { name: 'G-2027B-0042' });
    await expect.element(row).toBeInTheDocument();

    // The first row auto-selects on load, so the detail tile shows its title.
    const detail = screen.getByText('G-2027B-0042 · Grace Hopper');
    await expect.element(detail).toBeInTheDocument();

    // Clicking the selected row again deselects it (PrimeReact DataTable
    // defaults to metaKeySelection=false, so a plain re-click toggles the row
    // off); the detail panel must go away rather than snapping back to the
    // first row.
    await userEvent.click(row);
    await expect.element(detail).not.toBeInTheDocument();
  });

  it('offers a roster-backed contact-scientist picker in the accept award — sc-9624', async () => {
    const screen = await renderPage();
    // The first proposal auto-selects; choosing Accept reveals the award form.
    await userEvent.click(screen.getByRole('button', { name: 'Accept' }));

    await expect.element(screen.getByText('Contact Scientists')).toBeInTheDocument();
    // The field is the roster AutoComplete now, not the old free-text Chips
    // placeholder (both once shared the "Add a contact…" prompt).
    const contacts = screen.container.querySelector('#award-contacts');
    expect(contacts, 'contact-scientist input should be rendered').not.toBeNull();
    expect(contacts?.closest('.p-autocomplete')).not.toBeNull();
    expect(contacts?.closest('.p-chips')).toBeNull();
  });

  describe('accepting with configuration requests — sc-9595', () => {
    const requests = () => requestsAnswer([configurationRequest('x-1'), configurationRequest('x-2')]);

    async function accept(screen: Awaited<ReturnType<typeof renderPage>>) {
      await userEvent.click(screen.getByRole('button', { name: 'Accept' }));
      await userEvent.click(screen.getByRole('button', { name: 'Resolve' }));
    }

    it('approves the ticked requests and denies the unticked ones', async () => {
      const screen = await renderPage(
        requests(),
        setStatusMock('ACCEPTED'),
        updateProgramMock(),
        resolveRequestsMock(['x-1'], ['x-2']),
      );
      await userEvent.click(boxOf(screen, 'x-2'));
      await accept(screen);
      await expect.element(screen.getByText('Proposal accepted', { exact: true })).toBeVisible();
    });

    it('denies every pending request when all of them were unticked', async () => {
      const screen = await renderPage(
        requests(),
        setStatusMock('ACCEPTED'),
        updateProgramMock(),
        resolveRequestsMock([], ['x-1', 'x-2']),
      );
      await userEvent.click(boxOf(screen, 'x-1'));
      await userEvent.click(boxOf(screen, 'x-2'));
      await accept(screen);
      await expect.element(screen.getByText('Proposal accepted', { exact: true })).toBeVisible();
    });

    it('approves every request when none was unticked', async () => {
      const screen = await renderPage(
        requests(),
        setStatusMock('ACCEPTED'),
        updateProgramMock(),
        resolveRequestsMock(['x-1', 'x-2'], []),
      );
      await expect.element(screen.getByText('x-2', { exact: true })).toBeVisible();
      await accept(screen);
      await expect.element(screen.getByText('Proposal accepted', { exact: true })).toBeVisible();
    });

    it('sends only the pending requests, so a request already decided keeps its outcome', async () => {
      const screen = await renderPage(
        requestsAnswer([
          configurationRequest('x-1'),
          configurationRequest('x-2', 'DENIED'),
          configurationRequest('x-3', 'WITHDRAWN'),
        ]),
        setStatusMock('ACCEPTED'),
        updateProgramMock(),
        resolveRequestsMock(['x-1'], []),
      );
      await expect.poll(() => rowBoxes(screen).length).toBe(3);
      await accept(screen);
      await expect.element(screen.getByText('Proposal accepted', { exact: true })).toBeVisible();
    });

    it('leaves the requests alone when the proposal is rejected', async () => {
      // No mock for the requests mutation: a call to it would fail the resolve.
      const screen = await renderPage(requests(), setStatusMock('NOT_ACCEPTED'));
      await userEvent.click(boxOf(screen, 'x-2'));
      await userEvent.click(screen.getByRole('button', { name: 'Reject' }));
      await userEvent.click(screen.getByRole('button', { name: 'Resolve' }));
      await expect.element(screen.getByText('Proposal rejected', { exact: true })).toBeVisible();
    });

    it('names the requests step, still applies the award, reloads and drops the draft when the requests step fails after the acceptance', async () => {
      const failing: MockedResponseOf<typeof RESOLVE_PROPOSAL_REQUESTS_MUTATION> = {
        request: { query: RESOLVE_PROPOSAL_REQUESTS_MUTATION, variables: { approved: ['x-1', 'x-2'], denied: [] } },
        error: new Error('ODB unavailable'),
      };
      // The award is independent of the requests: its mutation must still go out.
      const award = vi.fn(() => ({
        data: {
          updatePrograms: {
            __typename: 'UpdateProgramsResult' as const,
            programs: [{ __typename: 'Program' as const, id: 'p-1' }],
          },
        },
      }));
      const updateProgram = { ...updateProgramMock(), result: award };
      // The first answer is the list as loaded; the reload after the failure returns the accepted proposal.
      const screen = await renderPageWith(
        { ...proposalsMock('SUBMITTED'), maxUsageCount: 1 },
        requests(),
        setStatusMock('ACCEPTED'),
        failing,
        updateProgram,
        proposalsMock('ACCEPTED'),
      );
      await userEvent.click(screen.getByRole('button', { name: 'Accept' }));
      await expect.element(screen.getByText('Time Awards')).toBeVisible();
      await userEvent.click(screen.getByRole('button', { name: 'Resolve' }));
      await expect.element(screen.getByText('Proposal accepted, but a later step failed')).toBeVisible();
      await expect
        .element(screen.getByText(/Configuration requests: .*ODB unavailable.*Change Requests tab/))
        .toBeVisible();
      expect(award).toHaveBeenCalledTimes(1);
      await expect.element(screen.getByRole('cell', { name: 'ACCEPTED' })).toBeVisible();
      // The award form belongs to a decision still to be made; this one has been.
      await expect.element(screen.getByText('Time Awards')).not.toBeInTheDocument();
    });

    it('names the award step, and still decides the requests, when the award fails after the acceptance', async () => {
      const failing: MockedResponseOf<typeof UPDATE_PROGRAM_MUTATION> = {
        request: {
          query: UPDATE_PROGRAM_MUTATION,
          variables: { programId: 'p-1', set: { goa: { proprietaryMonths: 12 } } },
        },
        error: new Error('ODB unavailable'),
      };
      // The requests mutation must still go out: it is spied on, since an unused mock is not a failure.
      const outcome = (id: string) => ({
        __typename: 'ConfigurationRequest' as const,
        id,
        status: 'APPROVED' as const,
        feedback: null,
      });
      const decide = vi.fn(() => ({
        data: {
          approved: {
            __typename: 'UpdateConfigurationRequestsResult' as const,
            requests: [outcome('x-1'), outcome('x-2')],
          },
          denied: { __typename: 'UpdateConfigurationRequestsResult' as const, requests: [] },
        },
      }));
      const screen = await renderPage(
        requests(),
        setStatusMock('ACCEPTED'),
        { ...resolveRequestsMock(['x-1', 'x-2'], []), result: decide },
        failing,
      );
      await accept(screen);
      await expect.element(screen.getByText('Proposal accepted, but a later step failed')).toBeVisible();
      await expect.element(screen.getByText(/Award details: .*ODB unavailable.*Programs/)).toBeVisible();
      await expect.element(screen.getByText(/Configuration requests:/)).not.toBeInTheDocument();
      expect(decide).toHaveBeenCalledTimes(1);
    });

    it('still reports the acceptance when only the reload of the requests fails', async () => {
      const refetchFails: MockedResponseOf<typeof PROGRAM_CONFIGURATION_REQUESTS_QUERY> = {
        request: { query: PROGRAM_CONFIGURATION_REQUESTS_QUERY, variables: { programId: 'p-1', offset: null } },
        error: new Error('ODB unavailable'),
        maxUsageCount: Infinity,
      };
      const screen = await renderPage(
        { ...requests(), maxUsageCount: 1 },
        setStatusMock('ACCEPTED'),
        resolveRequestsMock(['x-1', 'x-2'], []),
        updateProgramMock(),
        refetchFails,
      );
      await accept(screen);
      await expect.element(screen.getByText('Proposal accepted', { exact: true })).toBeVisible();
    });

    it('does not accept while the requests are still loading', async () => {
      const slow = { ...requests(), delay: 60_000 };
      const screen = await renderPage(slow);
      await accept(screen);
      await expect.element(screen.getByText('This proposal’s configuration requests have not loaded.')).toBeVisible();
    });

    it('does not accept while only some pages of the requests have arrived', async () => {
      const page = (
        offset: string | null,
        delay = 0,
      ): MockedResponseOf<typeof PROGRAM_CONFIGURATION_REQUESTS_QUERY> => ({
        request: { query: PROGRAM_CONFIGURATION_REQUESTS_QUERY, variables: { programId: 'p-1', offset } },
        delay,
        result: {
          data: {
            configurationRequests: {
              __typename: 'ConfigurationRequestSelectResult',
              matches: [configurationRequest('x-1')],
              hasMore: true,
            },
          },
        },
      });
      // The second page never arrives within the test, so the walk stays partial.
      const screen = await renderPage(page(null), page('x-1', 60_000));
      await accept(screen);
      await expect.element(screen.getByText('This proposal’s configuration requests have not loaded.')).toBeVisible();
    });

    it('does not accept when the walk of the requests cannot finish', async () => {
      // The ODB can answer a cursor with a page that ends on the cursor itself and still say hasMore (sc-10723),
      // so the walk stops while pages are still owed: not loading, yet not the whole list.
      const page = (offset: string | null): MockedResponseOf<typeof PROGRAM_CONFIGURATION_REQUESTS_QUERY> => ({
        request: { query: PROGRAM_CONFIGURATION_REQUESTS_QUERY, variables: { programId: 'p-1', offset } },
        result: {
          data: {
            configurationRequests: {
              __typename: 'ConfigurationRequestSelectResult',
              matches: [configurationRequest('x-1')],
              hasMore: true,
            },
          },
        },
      });
      const screen = await renderPage(page(null), page('x-1'));
      await expect.element(screen.getByText(/Could not load this proposal’s configuration requests\./)).toBeVisible();
      await accept(screen);
      await expect.element(screen.getByText('This proposal’s configuration requests have not loaded.')).toBeVisible();
    });

    it('does not touch the requests, or the proposal, when the requests have not loaded', async () => {
      const failing: MockedResponseOf<typeof PROGRAM_CONFIGURATION_REQUESTS_QUERY> = {
        request: { query: PROGRAM_CONFIGURATION_REQUESTS_QUERY, variables: { programId: 'p-1', offset: null } },
        error: new Error('ODB unavailable'),
      };
      // No status mock either: the guard has to stop the resolve before anything is sent.
      const screen = await renderPage(failing);
      await expect.element(screen.getByText(/Could not load this proposal’s configuration requests/)).toBeVisible();
      await accept(screen);
      await expect.element(screen.getByText('This proposal’s configuration requests have not loaded.')).toBeVisible();
    });

    it('accepts a proposal with no requests without calling the requests mutation', async () => {
      const screen = await renderPage(undefined, setStatusMock('ACCEPTED'), updateProgramMock());
      await accept(screen);
      await expect.element(screen.getByText('Proposal accepted', { exact: true })).toBeVisible();
    });
  });
});
