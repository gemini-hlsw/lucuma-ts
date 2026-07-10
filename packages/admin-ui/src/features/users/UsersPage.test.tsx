import type { MockLink } from '@apollo/client/testing';
import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';

import { PARTNERS, USERS_QUERY } from '@/gql/sso/roster';
import { fakeJwt, standardUser } from '@/test/factories';
import { renderWithContext } from '@/test/render';

import UsersPage from './UsersPage';

const rosterMock = (): MockLink.MockedResponse => ({
  request: { query: USERS_QUERY },
  result: {
    data: {
      users: [
        {
          __typename: 'User',
          id: 'u-1',
          orcidId: '0000-0001',
          profile: { __typename: 'UserProfile', givenName: 'Ada', familyName: 'Staffer', email: 'ada@x.org' },
          roles: [{ __typename: 'Role', id: 'r-1', type: 'STAFF', partner: null }],
        },
        {
          __typename: 'User',
          id: 'u-2',
          orcidId: '0000-0002',
          profile: { __typename: 'UserProfile', givenName: 'Bob', familyName: 'Plain', email: 'bob@x.org' },
          roles: [],
        },
      ],
    },
  },
});

const ADMIN_TOKEN = fakeJwt(standardUser('admin'));

describe('UsersPage', () => {
  it('renders the role-assignment grid with a column per partner + Staff/Adm', async () => {
    const screen = await renderWithContext(<UsersPage />, { token: ADMIN_TOKEN, mocks: [rosterMock()] });
    for (const h of ['Last', 'First', 'Email', 'ORCiD']) {
      await expect.element(screen.getByText(h)).toBeInTheDocument();
    }
    for (const p of PARTNERS) {
      await expect.element(screen.getByText(p, { exact: true })).toBeInTheDocument();
    }
    await expect.element(screen.getByRole('button', { name: 'Staff', exact: true })).toBeInTheDocument();
    await expect.element(screen.getByRole('button', { name: 'Adm', exact: true })).toBeInTheDocument();
  });

  it('shows a filter input', async () => {
    const screen = await renderWithContext(<UsersPage />, { token: ADMIN_TOKEN, mocks: [rosterMock()] });
    await expect.element(screen.getByPlaceholder(/filter name, email, or orcid/i)).toBeInTheDocument();
  });

  it('facets to holders of a role when its column header is clicked, and back', async () => {
    const screen = await renderWithContext(<UsersPage />, { token: ADMIN_TOKEN, mocks: [rosterMock()] });
    await expect.element(screen.getByText('Staffer')).toBeInTheDocument();
    await expect.element(screen.getByText('Plain')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Staff', exact: true }));
    await expect.element(screen.getByText('Staffer')).toBeInTheDocument();
    await expect.element(screen.getByText('Plain')).not.toBeInTheDocument();

    // Clicking the active facet again clears it.
    await userEvent.click(screen.getByRole('button', { name: 'Staff', exact: true }));
    await expect.element(screen.getByText('Plain')).toBeInTheDocument();
  });
});
