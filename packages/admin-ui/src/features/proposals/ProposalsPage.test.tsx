import { describe, expect, it } from 'vitest';

import { fakeJwt, standardUser } from '@/test/factories';
import { renderWithContext } from '@/test/render';

import ProposalsPage from './ProposalsPage';

const STAFF_TOKEN = fakeJwt(standardUser('staff'));

// The view reads live from the ODB (via Apollo). Under test there are no
// GraphQL mocks, so it renders its chrome + an empty list — we assert on that
// structure rather than on fabricated rows.
describe('ProposalsPage', () => {
  it('renders the Proposals tile with its master-list columns', async () => {
    const screen = await renderWithContext(<ProposalsPage />, { token: STAFF_TOKEN });
    await expect.element(screen.getByText('Proposals', { exact: true })).toBeInTheDocument();
    for (const h of ['Reference', 'Semester', 'PI', 'Type', 'Status', 'Title']) {
      await expect.element(screen.getByText(h, { exact: true })).toBeInTheDocument();
    }
  });

  it('offers status / type / semester facet dropdowns instead of a resolved toggle', async () => {
    const screen = await renderWithContext(<ProposalsPage />, { token: STAFF_TOKEN });
    await expect.element(screen.getByText('All statuses').first()).toBeInTheDocument();
    await expect.element(screen.getByText('All types').first()).toBeInTheDocument();
    await expect.element(screen.getByText('All semesters').first()).toBeInTheDocument();
    await expect.element(screen.getByText('Unresolved')).not.toBeInTheDocument();
  });
});
