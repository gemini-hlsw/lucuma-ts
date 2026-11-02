/**
 * The `semester` parameter belongs to /semester. A link minted there carries it everywhere, so what
 * matters is that nowhere else reads it: these pages must render identically with and without one.
 */
import type { MockLink } from '@apollo/client/testing';
import type { JSX } from 'react';
import { describe, expect, it } from 'vitest';

import Sidebar from '@/components/layout/Sidebar';
import { instrumentAvailabilityBlock } from '@/test/fixtures/blocks';
import { componentBrowser, instrumentComponent } from '@/test/fixtures/components';
import { nightSchedule } from '@/test/fixtures/night';
import { recentSpan, semesterSchedule } from '@/test/fixtures/semester';
import { nightsFromTonight } from '@/test/fixtures/tonight';
import { weekSchedule } from '@/test/fixtures/week';
import { renderWithRoute } from '@/test/render';

import ComponentsPage from './ComponentsPage';
import InstrumentsPage from './InstrumentsPage';
import NightPage from './NightPage';
import WeekPage from './WeekPage';

const NIGHT = '2025-11-14';
const GS_WHOLE = nightsFromTonight('GS', -60, 60);

const NIGHT_SCHEDULE = nightSchedule({ site: 'GS', night: NIGHT }, { dataAvailable: false });
const WEEK_SCHEDULE = weekSchedule({ site: 'GS', night: NIGHT });

const INSTRUMENTS = semesterSchedule(recentSpan('GS'), {
  instrumentAvailability: [
    instrumentAvailabilityBlock({ instrument: 'GHOST', at: { port: 1 }, interval: GS_WHOLE }),
    instrumentAvailabilityBlock({ instrument: 'GPI', at: { place: 'BASE' }, usage: 'UNAVAILABLE', interval: GS_WHOLE }),
  ],
});

const COMPONENTS = componentBrowser(recentSpan('GS'), {
  components: [instrumentComponent({ name: 'g' }), instrumentComponent({ id: 'k-gs-r', code: 'r_G0326', name: 'r' })],
});

describe('the semester parameter outside /semester', () => {
  it('leaves the night where the night parameter put it, whatever semester is named', async () => {
    const stale = await renderWithRoute(<NightPage />, {
      route: `/night?site=GS&night=${NIGHT}&semester=2024B`,
      mocks: [NIGHT_SCHEDULE],
    });

    await expect.element(stale.getByText(`Night of ${NIGHT}`)).toBeVisible();
  });

  it('opens the same week with a stale semester as without one', async () => {
    const plain = await renderWithRoute(<WeekPage />, {
      route: `/week?site=GS&night=${NIGHT}`,
      mocks: [WEEK_SCHEDULE],
    });
    const heading = plain.getByRole('heading', { level: 1 }).element().textContent;
    await plain.unmount();

    const stale = await renderWithRoute(<WeekPage />, {
      route: `/week?site=GS&night=${NIGHT}&semester=2099Z`,
      mocks: [WEEK_SCHEDULE],
    });

    await expect.poll(() => stale.getByRole('heading', { level: 1 }).element().textContent).toBe(heading);
  });

  it('scopes the finders to the site alone, never to a semester or a night', async () => {
    // The finders answer for tonight, so a semester or night in the URL must change nothing at all.
    const pages: { element: JSX.Element; testId: string; schedule: MockLink.MockedResponse }[] = [
      { element: <InstrumentsPage />, testId: 'instrument-table', schedule: INSTRUMENTS },
      { element: <ComponentsPage />, testId: 'component-table', schedule: COMPONENTS },
    ];

    for (const { element, testId, schedule } of pages) {
      const rendered = async (search: string): Promise<string> => {
        const screen = await renderWithRoute(element, {
          route: `/finder?site=GS${search}`,
          mocks: [schedule],
        });
        const table = screen.getByTestId(testId);
        await expect.element(table).toBeVisible();
        const text = table.element().textContent ?? '';
        expect(text).not.toBe('');
        await screen.unmount();
        return text;
      };

      expect(await rendered(`&semester=2024B&night=${NIGHT}`)).toBe(await rendered(''));
    }
  });
});

/** A page-scoped filter is one page's; nothing carries it to a destination that never asked for it. */
describe('a finder filter carried by a navigation link', () => {
  function InstrumentsWithNav(): JSX.Element {
    return (
      <>
        <Sidebar />
        <InstrumentsPage />
      </>
    );
  }

  it('does not reach the other finder', async () => {
    const screen = await renderWithRoute(<InstrumentsWithNav />, {
      route: `/instruments?site=GS&night=${NIGHT}&q=GPI`,
      extraRoutes: [{ path: '/components', element: <ComponentsPage /> }],
      mocks: [INSTRUMENTS, COMPONENTS],
    });

    await expect.element(screen.getByTestId('instrument-table')).toBeVisible();
    await expect.element(screen.getByLabelText('Search', { exact: true })).toHaveValue('GPI');

    await screen.getByRole('link', { name: 'Components', exact: true }).click();

    await expect.element(screen.getByTestId('component-table')).toBeVisible();
    await expect.element(screen.getByLabelText('Search', { exact: true })).toHaveValue('');
    await expect.poll(() => screen.router.location.search).not.toContain('q=GPI');
  });
});
