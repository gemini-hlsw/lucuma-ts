import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';

import { PROPOSAL_DETAILS_QUERY, PROPOSALS_QUERY } from '@/gql/odb/proposals';
import { fakeJwt, standardUser } from '@/test/factories';
import { type MockedResponseOf, renderWithContext } from '@/test/render';

import ProposalsPage from './ProposalsPage';

const STAFF_TOKEN = fakeJwt(standardUser('staff'));

const listMock = (hasMore = false): MockedResponseOf<typeof PROPOSALS_QUERY> => ({
  request: { query: PROPOSALS_QUERY, variables: { offset: null } },
  result: {
    data: {
      programs: {
        __typename: 'ProgramSelectResult',
        hasMore,
        matches: [
          {
            __typename: 'Program',
            id: 'p-1',
            name: 'A snap of a supernova',
            description: 'Time-critical imaging of a new SN.',
            proposalStatus: 'SUBMITTED',
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
          },
        ],
      },
    },
  },
});

/** Observations and groups arrive from a second query now (sc-10520); the page
 *  fires it for the special proposals the list turned up. */
const detailsMock = (): MockedResponseOf<typeof PROPOSAL_DETAILS_QUERY> => ({
  request: { query: PROPOSAL_DETAILS_QUERY, variables: { programIds: ['p-1'], offset: null } },
  result: {
    data: {
      programs: {
        __typename: 'ProgramSelectResult',
        hasMore: false,
        matches: [
          {
            __typename: 'Program',
            id: 'p-1',
            observations: { __typename: 'ObservationSelectResult', matches: [] },
            allGroupElements: [],
          },
        ],
      },
    },
  },
});

/** Both halves of the split, which is what every test here needs. */
const proposalsMock = () => [listMock(), detailsMock()];

describe(ProposalsPage, () => {
  it('lists special proposals with the master-list columns', async () => {
    const screen = await renderWithContext(<ProposalsPage />, { token: STAFF_TOKEN, mocks: proposalsMock() });
    await expect.element(screen.getByText('Proposals', { exact: true })).toBeInTheDocument();
    for (const h of ['Reference', 'Semester', 'PI', 'Type', 'Status', 'Title']) {
      await expect.element(screen.getByText(h, { exact: true })).toBeInTheDocument();
    }
    await expect.element(screen.getByRole('cell', { name: 'G-2027B-0042' })).toBeInTheDocument();
    await expect.element(screen.getByRole('cell', { name: 'Grace Hopper' })).toBeInTheDocument();
  });

  it('offers status / type / semester facet dropdowns instead of a resolved toggle', async () => {
    const screen = await renderWithContext(<ProposalsPage />, { token: STAFF_TOKEN, mocks: proposalsMock() });
    await expect.element(screen.getByText('All statuses').first()).toBeInTheDocument();
    await expect.element(screen.getByText('All types').first()).toBeInTheDocument();
    await expect.element(screen.getByText('All semesters').first()).toBeInTheDocument();
    await expect.element(screen.getByText('Unresolved')).not.toBeInTheDocument();
  });

  it('leaves nothing selected when the selected row is deselected — sc-10137', async () => {
    const screen = await renderWithContext(<ProposalsPage />, { token: STAFF_TOKEN, mocks: proposalsMock() });
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

  it('says the estimates are missing rather than "Live data" when the detail query fails — sc-10520', async () => {
    // The list succeeded, so the rows are real and the table is not empty —
    // but the Time column has nothing behind it. Claiming "Live data" over a
    // zero-hour row invites a reviewer to accept an award against an estimate
    // that never loaded.
    const screen = await renderWithContext(<ProposalsPage />, {
      token: STAFF_TOKEN,
      mocks: [
        listMock(),
        {
          request: { query: PROPOSAL_DETAILS_QUERY, variables: { programIds: ['p-1'], offset: null } },
          error: new Error('the ODB did not answer'),
        },
      ],
    });
    await expect
      .element(screen.getByText('Time estimates unavailable — the ODB did not return them.'))
      .toBeInTheDocument();
    expect(screen.container.textContent).not.toContain('Live data');
    // The proposal itself still renders — a detail failure must not blank the table.
    await expect.element(screen.getByText('G-2027B-0042 · Grace Hopper')).toBeInTheDocument();
  });

  it('says the LIST is incomplete, not just the estimates, when a list page dies', async () => {
    // Two different kinds of incompleteness, and the reader has to be told
    // which: a missing Time column is not the same as whole proposals absent
    // from the table.
    const screen = await renderWithContext(<ProposalsPage />, {
      token: STAFF_TOKEN,
      mocks: [
        listMock(true),
        {
          request: { query: PROPOSALS_QUERY, variables: { offset: 'p-1' } },
          error: new Error('the ODB stopped answering'),
        },
        detailsMock(),
      ],
    });
    await expect
      .element(screen.getByText('This list is incomplete — the ODB stopped returning proposals.'))
      .toBeInTheDocument();
    expect(screen.container.textContent).not.toContain('Live data');
    expect(screen.container.textContent).not.toContain('Time estimates unavailable');
  });

  it('offers a roster-backed contact-scientist picker in the accept award — sc-9624', async () => {
    const screen = await renderWithContext(<ProposalsPage />, { token: STAFF_TOKEN, mocks: proposalsMock() });
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
});
