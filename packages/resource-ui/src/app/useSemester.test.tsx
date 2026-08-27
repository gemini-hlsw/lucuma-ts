/**
 * `useSemester` - the one resolution of "which semester", shared by the
 * masthead control and every page that reads one.
 *
 * The URL carries a *request*; only the data can turn it into a semester. This
 * hook is where that happens, and it exists because the last private fallback
 * (`?? semesters[0]`) had the masthead blank on a stale name while the page
 * quietly drew the oldest semester in the list. `resolveSemester`'s own rules
 * are unit-tested in `domain/coverage.test.ts`; what is checked here is that
 * the hook feeds it the URL's site and night, and that the options it hands
 * the control are that site's, in date order.
 */
import { describe, expect, it } from 'vitest';

import { Probe } from '@/test/probe';
import { renderApp } from '@/test/renderApp';

import { useSemester } from './useSemester';

const openSemester = async (route: string) =>
  renderApp({
    route,
    element: (
      <Probe
        use={useSemester}
        readout={({ semester, semestersForSite, loading }) => ({
          semester: semester?.semester ?? (loading ? 'loading' : 'none'),
          options: semestersForSite.map((entry) => entry.semester).join(','),
        })}
      />
    ),
  });

describe(useSemester, () => {
  it('takes the semester the URL names', async () => {
    const screen = await openSemester('/semester?site=GS&semester=2025A');

    await expect.element(screen.getByTestId('probe-semester')).toHaveTextContent('2025A');
  });

  it('resolves the semester holding the night when the URL names none', async () => {
    const screen = await openSemester('/night?site=GS&night=2025-11-14');

    await expect.element(screen.getByTestId('probe-semester')).toHaveTextContent('2025B');
  });

  it('resolves a name the data does not hold, rather than leaving the control blank', async () => {
    // A stale link, or a semester dropped from the export. The night decides.
    const screen = await openSemester('/night?site=GS&semester=2099B&night=2025-11-14');

    await expect.element(screen.getByTestId('probe-semester')).toHaveTextContent('2025B');
  });

  it('offers the chosen site s semesters in date order, which is what the picker lists', async () => {
    const screen = await openSemester('/semester?site=GS');

    // GS only: GN's 2026B must not appear under a GS masthead.
    await expect.element(screen.getByTestId('probe-options')).toHaveTextContent('2024B,2025A,2025B,2026A');
  });

  it('follows the site, so switching it re-offers that site s own semesters', async () => {
    const screen = await openSemester('/semester?site=GN');

    await expect.element(screen.getByTestId('probe-options')).toHaveTextContent('2024B,2025A,2025B,2026A,2026B');
  });
});
