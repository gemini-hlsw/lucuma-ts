import type { MockLink } from '@apollo/client/testing';
import { fakeJwt, standardUser } from '@gemini-hlsw/lucuma-common-ui/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';

import {
  PROGRAM_CONFIGURATION_REQUESTS_QUERY,
  PROGRAM_OBSERVATIONS_QUERY,
  RESOLVE_PROPOSAL_REQUESTS_MUTATION,
} from '@/gql/odb/changeRequests';
import type { ConfigurationRequestStatus, ProposalStatus } from '@/gql/odb/gen/graphql';
import {
  ADD_PROGRAM_USER_MUTATION,
  allocationsInput,
  LINK_USER_MUTATION,
  SET_ALLOCATIONS_MUTATION,
  UPDATE_PROGRAM_MUTATION,
  useAssignContactScientists,
} from '@/gql/odb/programs';
import { PROPOSALS_QUERY, SET_PROPOSAL_STATUS_MUTATION } from '@/gql/odb/proposals';
import { USERS_QUERY } from '@/gql/sso/roster';
import { configurationRequest, emptyRoster } from '@/test/factories';
import { type MockedResponseOf, renderWithContext } from '@/test/render';
import { boxOf, rowBoxes } from '@/test/requestTable';

import ProposalsPage from './ProposalsPage';

// Real, but replaceable per test to simulate a bug.
vi.mock(import('@/gql/odb/programs'), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    allocationsInput: vi.fn(actual.allocationsInput),
    useAssignContactScientists: vi.fn(actual.useAssignContactScientists),
  };
});

const STAFF_TOKEN = fakeJwt(standardUser('staff'));

type Status = Extract<ProposalStatus, 'SUBMITTED' | 'ACCEPTED' | 'NOT_ACCEPTED'>;

const program = (id: string, reference: string, status: Status) => ({
  __typename: 'Program' as const,
  id,
  name: 'A snap of a supernova',
  description: 'Time-critical imaging of a new SN.',
  proposalStatus: status,
  pi: {
    __typename: 'ProgramUser' as const,
    id: 'm-1',
    user: {
      __typename: 'User' as const,
      id: 'u-1',
      profile: { __typename: 'UserProfile' as const, givenName: 'Grace', familyName: 'Hopper' },
    },
  },
  proposal: {
    __typename: 'Proposal' as const,
    reference: { __typename: 'ProposalReference' as const, label: reference },
    gemini: { __typename: 'DirectorsTime' as const, scienceSubtype: 'DIRECTORS_TIME' as const },
  },
  observations: { __typename: 'ObservationSelectResult' as const, matches: [] },
  allGroupElements: [],
});

const proposalsMock = (status: Status = 'SUBMITTED', withSecond = false): MockedResponseOf<typeof PROPOSALS_QUERY> => ({
  request: { query: PROPOSALS_QUERY, variables: { offset: null } },
  // Accepting reloads the list.
  maxUsageCount: Infinity,
  result: {
    data: {
      programs: {
        __typename: 'ProgramSelectResult',
        hasMore: false,
        matches: [
          program('p-1', 'G-2027B-0042', status),
          ...(withSecond ? [program('p-2', 'G-2027B-0043', 'SUBMITTED')] : []),
        ],
      },
    },
  },
});

const requestsAnswer = (
  matches: ReturnType<typeof configurationRequest>[],
  programId = 'p-1',
): MockedResponseOf<typeof PROGRAM_CONFIGURATION_REQUESTS_QUERY> => ({
  request: { query: PROGRAM_CONFIGURATION_REQUESTS_QUERY, variables: { programId, offset: null } },
  // Accepting reloads this program's requests.
  maxUsageCount: Infinity,
  result: {
    data: { configurationRequests: { __typename: 'ConfigurationRequestSelectResult', matches, hasMore: false } },
  },
});

const observationsAnswer = (programId = 'p-1'): MockedResponseOf<typeof PROGRAM_OBSERVATIONS_QUERY> => ({
  request: { query: PROGRAM_OBSERVATIONS_QUERY, variables: { programId, offset: null } },
  result: { data: { observations: { __typename: 'ObservationSelectResult', matches: [], hasMore: false } } },
});

/** The page as staff; it auto-selects the first proposal, whose requests are `requests`. */
const renderPageWith = (
  proposals: MockedResponseOf<typeof PROPOSALS_QUERY>,
  requests: MockedResponseOf<typeof PROGRAM_CONFIGURATION_REQUESTS_QUERY> = requestsAnswer([]),
  ...more: MockLink.MockedResponse[]
) =>
  renderWithContext(<ProposalsPage />, {
    token: STAFF_TOKEN,
    mocks: [proposals, requests, observationsAnswer(), ...more, emptyRoster()],
  });

const renderPage = (
  requests?: MockedResponseOf<typeof PROGRAM_CONFIGURATION_REQUESTS_QUERY>,
  ...more: MockLink.MockedResponse[]
) => renderPageWith(proposalsMock(), requests, ...more);

type Screen = Awaited<ReturnType<typeof renderPage>>;

const statusSet = () => ({
  data: {
    setProposalStatus: {
      __typename: 'SetProposalStatusResult' as const,
      program: { __typename: 'Program' as const, id: 'p-1' },
    },
  },
});

const setStatusMock = (
  status: Extract<ProposalStatus, 'ACCEPTED' | 'NOT_ACCEPTED'>,
): MockedResponseOf<typeof SET_PROPOSAL_STATUS_MUTATION> => ({
  request: { query: SET_PROPOSAL_STATUS_MUTATION, variables: { programId: 'p-1', status } },
  result: statusSet(),
});

const programUpdated = () => ({
  data: {
    updatePrograms: {
      __typename: 'UpdateProgramsResult' as const,
      programs: [{ __typename: 'Program' as const, id: 'p-1' }],
    },
  },
});

const updateProgramMock = (): MockedResponseOf<typeof UPDATE_PROGRAM_MUTATION> => ({
  request: { query: UPDATE_PROGRAM_MUTATION, variables: { programId: 'p-1', set: { goa: { proprietaryMonths: 12 } } } },
  result: programUpdated(),
});

const requestsDecided = (approved: string[], denied: string[]) => {
  const outcome = (ids: string[], status: Extract<ConfigurationRequestStatus, 'APPROVED' | 'DENIED'>) => ({
    __typename: 'UpdateConfigurationRequestsResult' as const,
    requests: ids.map((id) => ({ __typename: 'ConfigurationRequest' as const, id, status, feedback: null })),
  });
  return { data: { approved: outcome(approved, 'APPROVED'), denied: outcome(denied, 'DENIED') } };
};

const resolveRequestsMock = (
  approved: string[],
  denied: string[],
): MockedResponseOf<typeof RESOLVE_PROPOSAL_REQUESTS_MUTATION> => ({
  request: { query: RESOLVE_PROPOSAL_REQUESTS_MUTATION, variables: { approved, denied } },
  result: requestsDecided(approved, denied),
});

const ODB_DOWN = new Error('ODB unavailable');

describe(ProposalsPage, () => {
  beforeEach(() => {
    vi.mocked(allocationsInput).mockReset();
    vi.mocked(useAssignContactScientists).mockReset();
  });

  it('lists special proposals with the master-list columns', async () => {
    const screen = await renderPage();
    await expect.element(screen.getByText('Proposals', { exact: true })).toBeInTheDocument();
    for (const h of ['Reference', 'Semester', 'PI', 'Type', 'Status', 'Title']) {
      await expect.element(screen.getByText(h, { exact: true })).toBeInTheDocument();
    }
    await expect.element(screen.getByRole('cell', { name: 'G-2027B-0042' })).toBeInTheDocument();
    await expect.element(screen.getByRole('cell', { name: 'Grace Hopper' })).toBeInTheDocument();
  });

  it('offers status / type / semester facets instead of a resolved toggle', async () => {
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

    // The first row auto-selects on load.
    const detail = screen.getByText('G-2027B-0042 · Grace Hopper');
    await expect.element(detail).toBeInTheDocument();

    // A plain re-click toggles the row off (PrimeReact's metaKeySelection=false).
    await userEvent.click(row);
    await expect.element(detail).not.toBeInTheDocument();
  });

  it('offers a roster contact-scientist picker in the award — sc-9624', async () => {
    const screen = await renderPage();
    await userEvent.click(screen.getByRole('button', { name: 'Accept' }));

    await expect.element(screen.getByText('Contact Scientists')).toBeInTheDocument();
    // The roster AutoComplete, not the old free-text Chips.
    const contacts = screen.container.querySelector('#award-contacts');
    expect(contacts, 'contact-scientist input should be rendered').not.toBeNull();
    expect(contacts?.closest('.p-autocomplete')).not.toBeNull();
    expect(contacts?.closest('.p-chips')).toBeNull();
  });

  describe('accepting with configuration requests — sc-9595', () => {
    const requests = () => requestsAnswer([configurationRequest('x-1'), configurationRequest('x-2')]);

    async function accept(screen: Screen) {
      await userEvent.click(screen.getByRole('button', { name: 'Accept' }));
      await userEvent.click(screen.getByRole('button', { name: 'Resolve' }));
    }

    /** Accept is chosen, Resolve is disabled, and its hint gives `reason`. */
    async function expectBlocked(screen: Screen, reason: string | RegExp) {
      await userEvent.click(screen.getByRole('button', { name: 'Accept' }));
      await expect.element(screen.getByRole('button', { name: 'Resolve' })).toBeDisabled();
      await expect.element(screen.getByTitle(reason)).toBeInTheDocument();
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

    it('denies every request when all are unticked', async () => {
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

    it('approves every request when none is unticked', async () => {
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

    it('sends only the pending requests', async () => {
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

    it('leaves the requests alone on Reject', async () => {
      // No requests mutation mock: sending one would fail the resolve.
      const screen = await renderPage(requests(), setStatusMock('NOT_ACCEPTED'));
      await userEvent.click(boxOf(screen, 'x-2'));
      await userEvent.click(screen.getByRole('button', { name: 'Reject' }));
      await userEvent.click(screen.getByRole('button', { name: 'Resolve' }));
      await expect.element(screen.getByText('Proposal rejected', { exact: true })).toBeVisible();
    });

    it('stops when the status change fails, keeping the draft for a retry', async () => {
      const decide = vi.fn(() => requestsDecided(['x-1', 'x-2'], []));
      const screen = await renderPage(
        requests(),
        { request: setStatusMock('ACCEPTED').request, error: ODB_DOWN },
        setStatusMock('ACCEPTED'),
        { ...resolveRequestsMock(['x-1', 'x-2'], []), result: decide, maxUsageCount: 2 },
        updateProgramMock(),
      );
      await accept(screen);
      await expect.element(screen.getByText('Resolve failed')).toBeVisible();
      // The retry needs the kept draft, and only it may send the later steps.
      await userEvent.click(screen.getByRole('button', { name: 'Resolve' }));
      await expect.element(screen.getByText('Proposal accepted', { exact: true })).toBeVisible();
      expect(decide).toHaveBeenCalledTimes(1);
    });

    it('reloads the proposal and its requests after accepting', async () => {
      const screen = await renderPageWith(
        { ...proposalsMock('SUBMITTED'), maxUsageCount: 1 },
        { ...requestsAnswer([configurationRequest('x-1')]), maxUsageCount: 1 },
        setStatusMock('ACCEPTED'),
        resolveRequestsMock(['x-1'], []),
        updateProgramMock(),
        proposalsMock('ACCEPTED'),
        requestsAnswer([configurationRequest('x-1', 'APPROVED')]),
      );
      await accept(screen);
      await expect.element(screen.getByText('Proposal accepted', { exact: true })).toBeVisible();
      await expect.element(screen.getByRole('cell', { name: 'ACCEPTED' })).toBeVisible();
      await expect.element(screen.getByTitle('Approved')).toBeInTheDocument();
    });

    it('reloads the accepted program’s requests, not the one selected meanwhile', async () => {
      const held = Promise.withResolvers<undefined>();
      const screen = await renderWithContext(<ProposalsPage />, {
        token: STAFF_TOKEN,
        hold: { AdminResolveProposalRequests: held.promise },
        mocks: [
          proposalsMock('SUBMITTED', true),
          { ...requestsAnswer([configurationRequest('x-1')]), maxUsageCount: 1 },
          observationsAnswer(),
          setStatusMock('ACCEPTED'),
          resolveRequestsMock(['x-1'], []),
          updateProgramMock(),
          // Answers p-2 once: reloading it too would go unanswered and fail the test.
          { ...requestsAnswer([], 'p-2'), maxUsageCount: 1 },
          observationsAnswer('p-2'),
          requestsAnswer([configurationRequest('x-1', 'APPROVED')]),
          observationsAnswer(),
          emptyRoster(),
        ],
      });
      await accept(screen);
      await userEvent.click(screen.getByRole('cell', { name: 'G-2027B-0043' }));
      await expect.element(screen.getByText('G-2027B-0043 · Grace Hopper')).toBeVisible();
      await expect.element(screen.getByText('Proposal accepted', { exact: true })).not.toBeInTheDocument();

      held.resolve(undefined);
      await expect.element(screen.getByText('Proposal accepted', { exact: true })).toBeVisible();
      // The buttons unlock once the reload has settled; the other program was not reloaded.
      await expect.element(screen.getByRole('button', { name: 'Accept' })).toBeEnabled();
      expect(screen.getByText(/Could not load/).query()).toBeNull();
      // Reopened, the accepted program shows its outcome.
      await userEvent.click(screen.getByRole('cell', { name: 'G-2027B-0042' }));
      await expect.element(screen.getByTitle('Approved')).toBeInTheDocument();
    });

    it('keeps the requests on screen while a two-page reload walks', async () => {
      type RequestStatus = Extract<ConfigurationRequestStatus, 'REQUESTED' | 'APPROVED'>;
      const pageOf = (offset: string | null, status: RequestStatus) => ({
        data: {
          configurationRequests: {
            __typename: 'ConfigurationRequestSelectResult' as const,
            // OFFSET_AT repeats the cursor row.
            matches: (offset === null ? ['x-1'] : ['x-1', 'x-2']).map((id) => configurationRequest(id, status)),
            hasMore: offset === null,
          },
        },
      });
      const page = (
        offset: string | null,
        status: RequestStatus,
        maxUsageCount = 1,
      ): MockedResponseOf<typeof PROGRAM_CONFIGURATION_REQUESTS_QUERY> => ({
        request: { query: PROGRAM_CONFIGURATION_REQUESTS_QUERY, variables: { programId: 'p-1', offset } },
        maxUsageCount,
        result: pageOf(offset, status),
      });
      // Spied on, so the test waits for the reload's walk to finish.
      const lastPage = vi.fn(() => pageOf('x-1', 'APPROVED'));
      const reloadEnd = { ...page('x-1', 'APPROVED', Infinity), result: lastPage };
      const screen = await renderPage(
        page(null, 'REQUESTED'),
        page('x-1', 'REQUESTED'),
        setStatusMock('ACCEPTED'),
        resolveRequestsMock(['x-1', 'x-2'], []),
        updateProgramMock(),
        page(null, 'APPROVED', Infinity),
        reloadEnd,
      );
      await expect.poll(() => rowBoxes(screen).length).toBe(2);
      const dots = () => screen.container.querySelectorAll('.cr-dot').length;
      const counts: number[] = [];
      const observer = new MutationObserver(() => counts.push(dots()));
      observer.observe(screen.container, { subtree: true, childList: true });

      await accept(screen);
      await expect.element(screen.getByText('Proposal accepted', { exact: true })).toBeVisible();
      await expect.poll(() => lastPage).toHaveBeenCalled();
      await expect.poll(() => screen.container.querySelectorAll('[title="Approved"]').length).toBe(2);
      observer.disconnect();
      expect(counts).not.toContain(0);
    });

    it('locks the decision while a resolve is in flight', async () => {
      const held = Promise.withResolvers<undefined>();
      const setStatus = vi.fn(statusSet);
      const screen = await renderWithContext(<ProposalsPage />, {
        token: STAFF_TOKEN,
        hold: { AdminSetProposalStatus: held.promise },
        mocks: [
          proposalsMock(),
          requests(),
          observationsAnswer(),
          { ...setStatusMock('ACCEPTED'), result: setStatus, maxUsageCount: 2 },
          resolveRequestsMock(['x-1', 'x-2'], []),
          updateProgramMock(),
          emptyRoster(),
        ],
      });
      await accept(screen);
      await expect.element(screen.getByRole('button', { name: 'Reject' })).toBeDisabled();
      (screen.getByRole('button', { name: 'Reject' }).element() as HTMLButtonElement).click();
      expect(screen.container.querySelector<HTMLTextAreaElement>('.review-response')?.value).toMatch(
        /has been accepted/,
      );

      held.resolve(undefined);
      await expect.element(screen.getByText('Proposal accepted', { exact: true })).toBeVisible();
      expect(setStatus).toHaveBeenCalledTimes(1);
    });

    it('keeps the buttons locked until the list shows the decision', async () => {
      const reloaded = Promise.withResolvers<undefined>();
      let loads = 0;
      const screen = await renderWithContext(<ProposalsPage />, {
        token: STAFF_TOKEN,
        // The first load goes through; the reload waits.
        hold: { AdminProposals: () => (++loads > 1 ? reloaded.promise : undefined) },
        mocks: [
          { ...proposalsMock('SUBMITTED'), maxUsageCount: 1 },
          requests(),
          observationsAnswer(),
          setStatusMock('ACCEPTED'),
          resolveRequestsMock(['x-1', 'x-2'], []),
          updateProgramMock(),
          proposalsMock('ACCEPTED'),
          emptyRoster(),
        ],
      });
      await accept(screen);
      await expect.element(screen.getByText('Proposal accepted', { exact: true })).toBeVisible();
      await expect.element(screen.getByRole('button', { name: 'Accept' })).toBeDisabled();

      reloaded.resolve(undefined);
      await expect.element(screen.getByRole('cell', { name: 'ACCEPTED' })).toBeVisible();
      await expect.element(screen.getByRole('button', { name: 'Accept' })).not.toBeInTheDocument();
    });

    it('does not wait for the observations before Accept', async () => {
      const screen = await renderWithContext(<ProposalsPage />, {
        token: STAFF_TOKEN,
        mocks: [proposalsMock(), requests(), { ...observationsAnswer(), delay: 60_000 }, emptyRoster()],
      });
      await expect.poll(() => rowBoxes(screen).length).toBe(2);
      await userEvent.click(screen.getByRole('button', { name: 'Accept' }));
      await expect.element(screen.getByRole('button', { name: 'Resolve' })).toBeEnabled();
    });

    it('never shows one program’s requests while another’s walk is partial', async () => {
      const bPage = (offset: string | null): MockedResponseOf<typeof PROGRAM_CONFIGURATION_REQUESTS_QUERY> => ({
        request: { query: PROGRAM_CONFIGURATION_REQUESTS_QUERY, variables: { programId: 'p-2', offset } },
        maxUsageCount: Infinity,
        // The second page never arrives within the test.
        ...(offset === null ? {} : { delay: 60_000 }),
        result: {
          data: {
            configurationRequests: {
              __typename: 'ConfigurationRequestSelectResult',
              matches: [configurationRequest('y-1')],
              hasMore: true,
            },
          },
        },
      });
      const screen = await renderWithContext(<ProposalsPage />, {
        token: STAFF_TOKEN,
        mocks: [
          proposalsMock('SUBMITTED', true),
          requestsAnswer([configurationRequest('x-1')]),
          { ...observationsAnswer(), maxUsageCount: Infinity },
          bPage(null),
          bPage('y-1'),
          { ...observationsAnswer('p-2'), maxUsageCount: Infinity },
          emptyRoster(),
        ],
      });
      const open = async (reference: string) => {
        await userEvent.click(screen.getByRole('cell', { name: reference }));
        // The request fixtures' program has no PI, so only the reference is checked.
        await expect.element(screen.getByText(new RegExp(`^${reference} · `))).toBeVisible();
      };
      await expect.element(screen.getByText('x-1', { exact: true })).toBeVisible();
      // Visit B, so its partial first page is cached, then A, then B again.
      await open('G-2027B-0043');
      await open('G-2027B-0042');
      await expect.element(screen.getByText('x-1', { exact: true })).toBeVisible();
      await open('G-2027B-0043');
      // Checked in the commit that shows B: A's list must not stand in for it.
      expect(screen.getByText('x-1', { exact: true }).query()).toBeNull();
    });

    it('reloads the list after rejecting', async () => {
      const screen = await renderPageWith(
        { ...proposalsMock('SUBMITTED'), maxUsageCount: 1 },
        requests(),
        setStatusMock('NOT_ACCEPTED'),
        proposalsMock('NOT_ACCEPTED'),
      );
      await userEvent.click(screen.getByRole('button', { name: 'Reject' }));
      await userEvent.click(screen.getByRole('button', { name: 'Resolve' }));
      await expect.element(screen.getByRole('cell', { name: 'NOT_ACCEPTED' })).toBeVisible();
    });

    it('sends the status once on a double click', async () => {
      const setStatus = vi.fn(statusSet);
      const screen = await renderPage(
        requests(),
        { ...setStatusMock('ACCEPTED'), result: setStatus, maxUsageCount: 2 },
        resolveRequestsMock(['x-1', 'x-2'], []),
        updateProgramMock(),
      );
      await userEvent.click(screen.getByRole('button', { name: 'Accept' }));
      // Two clicks in one task, before React can re-render a disabled button.
      const resolve = screen.getByRole('button', { name: 'Resolve' }).element() as HTMLButtonElement;
      resolve.click();
      resolve.click();
      await expect.element(screen.getByText('Proposal accepted', { exact: true })).toBeVisible();
      expect(setStatus).toHaveBeenCalledTimes(1);
    });

    it('sends nothing on an unexpected error before the status, keeping the draft', async () => {
      vi.mocked(allocationsInput).mockImplementationOnce(() => {
        throw new Error('Broken award');
      });
      const setStatus = vi.fn(statusSet);
      const screen = await renderPage(requests(), { ...setStatusMock('ACCEPTED'), result: setStatus });
      await accept(screen);
      await expect.element(screen.getByText('Resolve failed')).toBeVisible();
      await expect.element(screen.getByText(/Broken award/)).toBeVisible();
      await expect.element(screen.getByText('Time Awards')).toBeVisible();
      expect(setStatus).not.toHaveBeenCalled();
    });

    it('keeps Resolve disabled until every step is done', async () => {
      const held = Promise.withResolvers<undefined>();
      const screen = await renderWithContext(<ProposalsPage />, {
        token: STAFF_TOKEN,
        hold: { AdminUpdateProgram: held.promise },
        mocks: [
          proposalsMock(),
          requests(),
          observationsAnswer(),
          setStatusMock('ACCEPTED'),
          resolveRequestsMock(['x-1', 'x-2'], []),
          updateProgramMock(),
          emptyRoster(),
        ],
      });
      await accept(screen);
      await expect.element(screen.getByRole('button', { name: 'Resolve' })).toBeDisabled();
      held.resolve(undefined);
      await expect.element(screen.getByText('Proposal accepted', { exact: true })).toBeVisible();
    });

    it('stops at a failed requests step, says what is left, and still reloads', async () => {
      const award = vi.fn(programUpdated);
      // The reloads return the server's state: accepted, with x-1 approved before the error.
      const screen = await renderPageWith(
        { ...proposalsMock('SUBMITTED'), maxUsageCount: 1 },
        { ...requests(), maxUsageCount: 1 },
        setStatusMock('ACCEPTED'),
        { request: resolveRequestsMock(['x-1', 'x-2'], []).request, error: ODB_DOWN },
        { ...updateProgramMock(), result: award },
        proposalsMock('ACCEPTED'),
        requestsAnswer([configurationRequest('x-1', 'APPROVED'), configurationRequest('x-2')]),
      );
      await userEvent.click(screen.getByRole('button', { name: 'Accept' }));
      await expect.element(screen.getByText('Time Awards')).toBeVisible();
      await userEvent.click(screen.getByRole('button', { name: 'Resolve' }));
      await expect
        .element(screen.getByText('Proposal accepted, but deciding the configuration requests failed'))
        .toBeVisible();
      await expect
        .element(
          screen.getByText(
            'ODB unavailable. To fix, finish them on the Change Requests tab. Not done: setting the active and proprietary periods (set them again in Programs).',
          ),
        )
        .toBeVisible();
      await expect.element(screen.getByRole('cell', { name: 'ACCEPTED' })).toBeVisible();
      await expect.element(screen.getByTitle('Approved')).toBeInTheDocument();
      expect(award).not.toHaveBeenCalled();
      // The award form is for an undecided proposal.
      await expect.element(screen.getByText('Time Awards')).not.toBeInTheDocument();
    });

    it('decides the requests before the award, and names the award step when it fails', async () => {
      const decide = vi.fn(() => requestsDecided(['x-1', 'x-2'], []));
      const screen = await renderPage(
        requests(),
        setStatusMock('ACCEPTED'),
        { ...resolveRequestsMock(['x-1', 'x-2'], []), result: decide },
        { request: updateProgramMock().request, error: ODB_DOWN },
      );
      await accept(screen);
      await expect
        .element(screen.getByText('Proposal accepted, but setting the active and proprietary periods failed'))
        .toBeVisible();
      await expect.element(screen.getByText('ODB unavailable. To fix, set them again in Programs.')).toBeVisible();
      expect(decide).toHaveBeenCalledTimes(1);
    });

    it('still accepts, and shows the error, when only the requests reload fails', async () => {
      const screen = await renderPage(
        { ...requests(), maxUsageCount: 1 },
        setStatusMock('ACCEPTED'),
        resolveRequestsMock(['x-1', 'x-2'], []),
        updateProgramMock(),
        { request: requests().request, error: ODB_DOWN, maxUsageCount: Infinity },
      );
      await accept(screen);
      await expect.element(screen.getByText('Proposal accepted', { exact: true })).toBeVisible();
      await expect.element(screen.getByText(/Could not load this proposal’s configuration requests/)).toBeVisible();
    });

    const roster: MockedResponseOf<typeof USERS_QUERY> = {
      request: { query: USERS_QUERY },
      maxUsageCount: Infinity,
      result: {
        data: {
          users: {
            __typename: 'UserSelectResult',
            hasMore: false,
            matches: [
              {
                __typename: 'User',
                id: 'u-7',
                orcidId: null,
                profile: {
                  __typename: 'UserProfile',
                  givenName: 'Ada',
                  familyName: 'Lovelace',
                  email: 'ada@example.org',
                },
                roles: [],
              },
            ],
          },
        },
      },
    };

    /** Mocks for the award steps, logging each one's name to `log` as it is sent. */
    const awardMocks = (log: string[], failAllocations = false): MockLink.MockedResponse[] => {
      const allocations: MockedResponseOf<typeof SET_ALLOCATIONS_MUTATION> = {
        request: { query: SET_ALLOCATIONS_MUTATION, variables: (v) => v.programId === 'p-1' },
        ...(failAllocations
          ? { error: ODB_DOWN }
          : {
              result: () => {
                log.push('allocations');
                return {
                  data: {
                    setAllocations: {
                      __typename: 'SetAllocationsResult',
                      allocations: [{ __typename: 'Allocation', category: 'CAL' }],
                    },
                  },
                };
              },
            }),
      };
      const addUser: MockedResponseOf<typeof ADD_PROGRAM_USER_MUTATION> = {
        request: { query: ADD_PROGRAM_USER_MUTATION, variables: { programId: 'p-1' } },
        result: () => {
          log.push('contacts');
          return {
            data: {
              addProgramUser: {
                __typename: 'AddProgramUserResult',
                programUser: { __typename: 'ProgramUser', id: 'm-9' },
              },
            },
          };
        },
      };
      const link: MockedResponseOf<typeof LINK_USER_MUTATION> = {
        request: { query: LINK_USER_MUTATION, variables: { programUserId: 'm-9', userId: 'u-7' } },
        result: {
          data: { linkUser: { __typename: 'LinkUserResult', user: { __typename: 'ProgramUser', id: 'm-9' } } },
        },
      };
      return [
        allocations,
        {
          ...updateProgramMock(),
          result: () => {
            log.push('periods');
            return programUpdated();
          },
        },
        addUser,
        link,
      ];
    };

    /** Accept with two hours of Calibration time and Ada Lovelace as contact scientist. */
    async function acceptWithAward(screen: Screen) {
      await userEvent.click(screen.getByRole('button', { name: 'Accept' }));
      await userEvent.click(screen.getByText('Add category').last());
      await userEvent.click(screen.getByText('CAL — Calibration'));
      await userEvent.click(screen.getByRole('button', { name: 'Add', exact: true }));
      await userEvent.fill(screen.getByRole('spinbutton').first(), '2');
      await userEvent.tab();
      await userEvent.fill(screen.container.querySelector('#award-contacts')!, 'Ada');
      await userEvent.click(screen.getByText('Ada Lovelace'));
      await userEvent.click(screen.getByRole('button', { name: 'Resolve' }));
    }

    it('runs every step in order', async () => {
      const log: string[] = [];
      const screen = await renderPage(
        requests(),
        setStatusMock('ACCEPTED'),
        {
          ...resolveRequestsMock(['x-1', 'x-2'], []),
          result: () => {
            log.push('requests');
            return requestsDecided(['x-1', 'x-2'], []);
          },
        },
        roster,
        ...awardMocks(log),
      );
      await acceptWithAward(screen);
      await expect.element(screen.getByText('Proposal accepted', { exact: true })).toBeVisible();
      expect(log).toEqual(['requests', 'allocations', 'periods', 'contacts']);
    });

    it('reports a step that throws at once like any failed step', async () => {
      vi.mocked(useAssignContactScientists).mockImplementation(() => ({
        assign: () => {
          throw new Error('Broken assign');
        },
        loading: false,
      }));
      const screen = await renderPageWith(
        { ...proposalsMock('SUBMITTED'), maxUsageCount: 1 },
        requests(),
        setStatusMock('ACCEPTED'),
        resolveRequestsMock(['x-1', 'x-2'], []),
        roster,
        ...awardMocks([]),
        proposalsMock('ACCEPTED'),
      );
      await acceptWithAward(screen);
      await expect
        .element(screen.getByText('Proposal accepted, but assigning the contact scientists failed'))
        .toBeVisible();
      await expect.element(screen.getByRole('cell', { name: 'ACCEPTED' })).toBeVisible();
    });

    it('lists every step left undone', async () => {
      const log: string[] = [];
      const screen = await renderPage(undefined, setStatusMock('ACCEPTED'), roster, ...awardMocks(log, true));
      await acceptWithAward(screen);
      await expect.element(screen.getByText('Proposal accepted, but setting the time awards failed')).toBeVisible();
      await expect
        .element(
          screen.getByText(
            'ODB unavailable. To fix, set them again in Programs. Not done: setting the active and proprietary periods (set them again in Programs), assigning the contact scientists (assign them again in Programs).',
          ),
        )
        .toBeVisible();
      expect(log).toEqual([]);
    });

    it('blocks Accept while the requests load', async () => {
      const screen = await renderPage({ ...requests(), delay: 60_000 });
      await expectBlocked(screen, 'Waiting for this proposal’s configuration requests to load.');
    });

    it('blocks Accept while only some pages are in', async () => {
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
      // The second page never arrives within the test.
      const screen = await renderPage(page(null), page('x-1', 60_000));
      await expectBlocked(screen, 'Waiting for this proposal’s configuration requests to load.');
    });

    it('blocks Accept when the page walk cannot finish', async () => {
      // A cursor answered with itself and hasMore stalls the walk (sc-10723).
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
      await expectBlocked(screen, 'Could not load all of this proposal’s configuration requests.');
    });

    it('blocks Accept with the error when the requests fail to load, but not Reject', async () => {
      const screen = await renderPage({ request: requests().request, error: ODB_DOWN }, setStatusMock('NOT_ACCEPTED'));
      await expect.element(screen.getByText(/Could not load this proposal’s configuration requests/)).toBeVisible();
      await expectBlocked(screen, /^Could not load this proposal’s configuration requests: .*ODB unavailable/);

      await userEvent.click(screen.getByRole('button', { name: 'Reject' }));
      await userEvent.click(screen.getByRole('button', { name: 'Resolve' }));
      await expect.element(screen.getByText('Proposal rejected', { exact: true })).toBeVisible();
    });

    it('accepts a proposal with no requests without the requests mutation', async () => {
      const screen = await renderPage(undefined, setStatusMock('ACCEPTED'), updateProgramMock());
      await accept(screen);
      await expect.element(screen.getByText('Proposal accepted', { exact: true })).toBeVisible();
    });
  });
});
