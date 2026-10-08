/**
 * The `semester` parameter belongs to /semester. A link minted there carries it everywhere, so what
 * matters is that nowhere else reads it: these pages must render identically with and without one.
 */
import type { MockLink } from '@apollo/client/testing';
import type { MockedResponseOf } from '@gemini-hlsw/lucuma-common-ui/testing';
import { NIGHT_SCHEDULE_QUERY, WEEK_SCHEDULE_QUERY } from '@gql/resource';
import type { JSX } from 'react';
import { describe, expect, it } from 'vitest';

import Sidebar from '@/components/layout/Sidebar';
import { addDays } from '@/domain/semester';
import { WEEK_NIGHTS } from '@/domain/weekTimeline';
import { instrumentAvailabilityBlock, overNights } from '@/test/fixtures/blocks';
import { componentBrowser, instrumentComponent } from '@/test/fixtures/components';
import { publishedSemester, publishedSemesters, recentSpan, semesterSchedule } from '@/test/fixtures/semester';
import { nightsFromTonight } from '@/test/fixtures/tonight';
import { renderApp } from '@/test/renderApp';

import ComponentsPage from './ComponentsPage';
import InstrumentsPage from './InstrumentsPage';
import NightPage from './NightPage';
import WeekPage from './WeekPage';

const NIGHT = '2025-11-14';
const GS_2024B = publishedSemester({ site: 'GS', semester: '2024B' });
const GS_2025B = publishedSemester({ site: 'GS', semester: '2025B' });
const SEMESTERS = publishedSemesters(GS_2024B, GS_2025B);
const GS_WHOLE = nightsFromTonight('GS', -60, 60);

/** The API takes an interval as plain start and end; a selected one carries its `__typename` too. */
const asInput = ({ start, end }: { start: string; end: string }) => ({ start, end });

const NIGHT_SCHEDULE: MockedResponseOf<typeof NIGHT_SCHEDULE_QUERY> = {
  request: {
    query: NIGHT_SCHEDULE_QUERY,
    variables: { site: 'GS', night: NIGHT, ...asInput(overNights('GS', NIGHT, NIGHT)) },
  },
  result: {
    data: {
      telescopeNight: {
        __typename: 'TelescopeNight',
        observingNight: NIGHT,
        dataAvailable: false,
        interval: overNights('GS', NIGHT, NIGHT),
      },
      instrumentAvailability: [],
      telescopeAvailability: [],
      tooSupport: [],
      telescopeMode: [],
      telescopeSubsystemAvailability: [],
    },
  },
};

const WEEK_SCHEDULE: MockedResponseOf<typeof WEEK_SCHEDULE_QUERY> = {
  request: {
    query: WEEK_SCHEDULE_QUERY,
    variables: {
      site: 'GS',
      nightsStart: NIGHT,
      nightsEnd: addDays(NIGHT, WEEK_NIGHTS),
      ...asInput(overNights('GS', NIGHT, addDays(NIGHT, WEEK_NIGHTS - 1))),
    },
  },
  result: {
    data: {
      telescopeNights: [],
      instrumentAvailability: [],
      telescopeAvailability: [],
      instrumentComponentAvailability: [],
      tooSupport: [],
      telescopeMode: [],
    },
  },
};

const INSTRUMENTS = semesterSchedule(recentSpan('GS'), {
  instrumentAvailability: [
    instrumentAvailabilityBlock({ instrument: 'GHOST', location: { port: 1 }, interval: GS_WHOLE }),
    instrumentAvailabilityBlock({
      instrument: 'GPI',
      location: { place: 'BASE' },
      usage: 'UNAVAILABLE',
      interval: GS_WHOLE,
    }),
  ],
});

const COMPONENTS = componentBrowser(recentSpan('GS'), {
  components: [instrumentComponent({ name: 'g' }), instrumentComponent({ id: 'k-gs-r', code: 'r_G0326', name: 'r' })],
});

describe('the semester parameter outside /semester', () => {
  it('leaves the night where the night parameter put it, whatever semester is named', async () => {
    const stale = await renderApp({
      element: <NightPage />,
      route: `/night?site=GS&night=${NIGHT}&semester=2024B`,
      mocks: [SEMESTERS, NIGHT_SCHEDULE],
    });

    // 2024B does not hold this night; the page still reports the night it was asked for,
    // and names the semester that really holds it.
    await expect.element(stale.getByText(`Night of ${NIGHT}`)).toBeVisible();
    await expect.element(stale.getByRole('link', { name: /2025B/ })).toBeVisible();
  });

  it('opens the same week with a stale semester as without one', async () => {
    const plain = await renderApp({
      element: <WeekPage />,
      route: `/week?site=GS&night=${NIGHT}`,
      mocks: [SEMESTERS, WEEK_SCHEDULE],
    });
    const heading = plain.getByRole('heading', { level: 1 }).element().textContent;
    await plain.unmount();

    const stale = await renderApp({
      element: <WeekPage />,
      route: `/week?site=GS&night=${NIGHT}&semester=2099Z`,
      mocks: [SEMESTERS, WEEK_SCHEDULE],
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
        const screen = await renderApp({
          element,
          route: `/finder?site=GS${search}`,
          mocks: [SEMESTERS, schedule],
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
    const screen = await renderApp({
      element: <InstrumentsWithNav />,
      route: `/instruments?site=GS&night=${NIGHT}&q=GPI`,
      extraRoutes: [{ path: '/components', element: <ComponentsPage /> }],
      mocks: [SEMESTERS, INSTRUMENTS, COMPONENTS],
    });

    await expect.element(screen.getByTestId('instrument-table')).toBeVisible();
    await expect.element(screen.getByLabelText('Search', { exact: true })).toHaveValue('GPI');

    await screen.getByRole('link', { name: 'Components', exact: true }).click();

    await expect.element(screen.getByTestId('component-table')).toBeVisible();
    await expect.element(screen.getByLabelText('Search', { exact: true })).toHaveValue('');
    await expect.poll(() => screen.router.state.location.search).not.toContain('q=GPI');
  });
});
