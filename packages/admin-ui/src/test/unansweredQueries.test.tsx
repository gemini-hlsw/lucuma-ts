import { describe, expect, it } from 'vitest';

import ProgramsPage from '@/features/programs/ProgramsPage';

import { fakeJwt, standardUser } from './factories';
import { renderWithContext } from './render';
import { assertNoUnansweredQueries, takeUnansweredQueries } from './unansweredQueries';

describe(assertNoUnansweredQueries, () => {
  it('fails the test that left a query unanswered, and says which', async () => {
    await renderWithContext(<ProgramsPage />, { token: fakeJwt(standardUser('staff')), mocks: [] });

    // Reporting drains the record, so the afterEach that runs this for every test finds nothing left here.
    await expect
      .poll(() => {
        try {
          assertNoUnansweredQueries();
          return 'passed';
        } catch (error) {
          return String(error);
        }
      })
      .toContain('query AdminPrograms');
  });
});

describe(takeUnansweredQueries, () => {
  it('reports nothing when every query is answered', () => {
    expect(takeUnansweredQueries()).toEqual([]);
  });
});
