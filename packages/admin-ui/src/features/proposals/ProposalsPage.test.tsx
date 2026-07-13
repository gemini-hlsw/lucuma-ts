import { describe, expect, it } from 'vitest';

import { PROPOSALS_QUERY } from '@/gql/proposals';
import { fakeJwt, standardUser } from '@/test/factories';
import { type MockedResponseOf, renderWithContext } from '@/test/render';

import ProposalsPage from './ProposalsPage';

const STAFF_TOKEN = fakeJwt(standardUser('staff'));

const proposalsMock = (): MockedResponseOf<typeof PROPOSALS_QUERY> => ({
  request: { query: PROPOSALS_QUERY },
  result: {
    data: {
      programs: {
        __typename: 'ProgramSelectResult',
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
            observations: { __typename: 'ObservationSelectResult', matches: [] },
          },
        ],
      },
    },
  },
});

describe('ProposalsPage', () => {
  it('lists special proposals with the master-list columns', async () => {
    const screen = await renderWithContext(<ProposalsPage />, { token: STAFF_TOKEN, mocks: [proposalsMock()] });
    await expect.element(screen.getByText('Proposals', { exact: true })).toBeInTheDocument();
    for (const h of ['Reference', 'Semester', 'PI', 'Type', 'Status', 'Title']) {
      await expect.element(screen.getByText(h, { exact: true })).toBeInTheDocument();
    }
    await expect.element(screen.getByRole('cell', { name: 'G-2027B-0042' })).toBeInTheDocument();
    await expect.element(screen.getByRole('cell', { name: 'Grace Hopper' })).toBeInTheDocument();
  });

  it('offers status / type / semester facet dropdowns instead of a resolved toggle', async () => {
    const screen = await renderWithContext(<ProposalsPage />, { token: STAFF_TOKEN, mocks: [proposalsMock()] });
    await expect.element(screen.getByText('All statuses').first()).toBeInTheDocument();
    await expect.element(screen.getByText('All types').first()).toBeInTheDocument();
    await expect.element(screen.getByText('All semesters').first()).toBeInTheDocument();
    await expect.element(screen.getByText('Unresolved')).not.toBeInTheDocument();
  });
});
