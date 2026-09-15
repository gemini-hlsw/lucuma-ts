import { describe, expect, it } from 'vitest';

import type { PublishedSemester } from '@/domain/types';
import { renderApp } from '@/test/renderApp';

import { SemesterTitleLink } from './SemesterTitleLink';

const semester = (
  over: Partial<PublishedSemester> & Pick<PublishedSemester, 'site' | 'semester' | 'title'>,
): PublishedSemester => ({
  version: null,
  holidays: [],
  moonEvents: [],
  demo: false,
  firstNight: '2026-08-02',
  lastNight: '2027-02-01',
  ...over,
});

describe(SemesterTitleLink, () => {
  it('opens the named semester, keeping the night and dropping every page-scoped parameter', async () => {
    const target = semester({ site: 'GS', semester: '2026B', title: 'GS 2026B' });
    const screen = await renderApp({
      element: <SemesterTitleLink semester={target} />,
      route: '/night?site=GN&night=2026-09-14&q=GPI&view=calendar&month=2026-09',
    });

    await expect
      .element(screen.getByRole('link', { name: 'GS 2026B' }))
      .toHaveAttribute('href', '/semester?site=GS&night=2026-09-14&semester=2026B');
  });

  it("forces the semester's own site over one carried from the current URL", async () => {
    const target = semester({ site: 'GS', semester: '2026B', title: 'GS 2026B' });
    const screen = await renderApp({
      element: <SemesterTitleLink semester={target} />,
      route: '/night?site=GN',
    });

    await expect
      .element(screen.getByRole('link', { name: 'GS 2026B' }))
      .toHaveAttribute('href', '/semester?site=GS&semester=2026B');
  });
});
