import { describe, expect, it } from 'vitest';

import SemesterPage from '@/app/pages/SemesterPage';

import { renderApp } from './renderApp';
import { takeUnansweredQueries } from './unansweredQueries';

describe(takeUnansweredQueries, () => {
  it('reports a query that no mocked response answers', async () => {
    await renderApp({ element: <SemesterPage />, route: '/semester', mocks: [] });

    await expect.poll(takeUnansweredQueries).toEqual([expect.stringContaining('query PublishedSemesters')]);
  });

  it('reports nothing when every query is answered', () => {
    expect(takeUnansweredQueries()).toEqual([]);
  });
});
