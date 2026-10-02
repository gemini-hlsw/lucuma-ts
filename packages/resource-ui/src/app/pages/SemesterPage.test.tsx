import type { MockLink } from '@apollo/client/testing';
import { isNotNullish } from '@gemini-hlsw/lucuma-common-ui';
import { describe, expect, it } from 'vitest';

import Layout from '@/components/layout/Layout';
import { buildSemesterTimeline } from '@/domain/semesterTimeline';
import { buildMonthLines } from '@/features/semester/semesterMonthOptions';
import {
  instrumentAvailabilityBlock,
  overNights,
  telescopeAvailabilityBlock,
  telescopeModeBlock,
} from '@/test/fixtures/blocks';
import { publishedSemester, publishedSemesters, semesterSchedule } from '@/test/fixtures/semester';
import { chooseClock, chooseSite, openDropdown, selectDropdownOption } from '@/test/helpers';
import { Probe, PROBE_URL_TESTID } from '@/test/probe';
import { renderApp } from '@/test/renderApp';

import SemesterPage from './SemesterPage';

const GS_2024B = publishedSemester({ site: 'GS', semester: '2024B' });
const GS_2025A = publishedSemester({ site: 'GS', semester: '2025A' });
const GS_2025B = publishedSemester({ site: 'GS', semester: '2025B' });
const GN_2025B = publishedSemester({ site: 'GN', semester: '2025B' });
const GN_2026B = publishedSemester({ site: 'GN', semester: '2026B' });

const GS_2025B_WHOLE = overNights('GS', '2025-08-02', '2026-02-01');
const GN_2026B_WHOLE = overNights('GN', '2026-08-02', '2027-02-01');

const GHOST = instrumentAvailabilityBlock({ instrument: 'GHOST', port: 1, interval: GS_2025B_WHOLE });
const GCAL = instrumentAvailabilityBlock({ instrument: 'GCAL', port: 2, interval: GS_2025B_WHOLE });

const openSemester = (route: string, ...mocks: MockLink.MockedResponse[]) =>
  renderApp({ element: <SemesterPage />, route, mocks });

/** The semester page inside the real shell, for the controls the masthead owns. */
const openSemesterInShell = (route: string, ...mocks: MockLink.MockedResponse[]) =>
  renderApp({
    element: <Layout />,
    route,
    path: '/',
    childRoutes: [{ path: 'semester', element: <SemesterPage /> }],
    mocks,
  });

/** Stands in for the night view: the subject is the jump, not what the night draws. */
const NIGHT_ROUTE = { path: '/night', element: <Probe use={() => null} /> };

const shownUrl = () => document.querySelector(`[data-testid="${PROBE_URL_TESTID}"]`)?.textContent ?? '';

const drawnBars = () =>
  [...document.querySelectorAll('[data-testid^="semester-month-"] path.highcharts-point')]
    .map((point) => `${point.getAttribute('d') ?? ''}#${point.getAttribute('fill') ?? ''}`)
    .join('|');

describe(SemesterPage, () => {
  describe('the chart', () => {
    it('opens on the chart, one block per month', async () => {
      const screen = await openSemester(
        '/semester?site=GS&semester=2025B',
        publishedSemesters(GS_2025B),
        semesterSchedule(GS_2025B),
      );

      await expect.element(screen.getByText('Gemini South Semester 2025B', { exact: false })).toBeVisible();
      await expect.element(screen.getByTestId('semester-timeline')).toBeVisible();
      // August 2025 through January 2026, grouped by the evening date's month.
      await expect.element(screen.getByRole('region', { name: 'August 2025' })).toBeVisible();
      await expect.element(screen.getByRole('region', { name: 'January 2026' })).toBeVisible();
    });

    it('names each instrument on its run rather than in the colour', async () => {
      const screen = await openSemester(
        '/semester?site=GS&semester=2025B',
        publishedSemesters(GS_2025B),
        semesterSchedule(GS_2025B, { instrumentAvailability: [GHOST, GCAL] }),
      );

      // Identity is text, which survives every kind of colour vision.
      await expect.element(screen.getByText('GHOST').first()).toBeVisible();
      await expect.element(screen.getByText('GCAL').first()).toBeVisible();
    });

    it('keys the colours to instruments, listing only the ones it drew', async () => {
      const screen = await openSemester(
        '/semester?site=GN&semester=2026B',
        publishedSemesters(GN_2026B),
        semesterSchedule(GN_2026B, {
          instrumentAvailability: [
            instrumentAvailabilityBlock({
              instrument: 'GMOS',
              publishedName: 'GMOS-N',
              port: 1,
              interval: GN_2026B_WHOLE,
            }),
            instrumentAvailabilityBlock({ instrument: 'ALTAIR', port: 3, interval: GN_2026B_WHOLE }),
          ],
          telescopeAvailability: [
            telescopeAvailabilityBlock({ interval: overNights('GN', '2026-10-21', '2026-10-24') }),
          ],
        }),
      );
      const legend = screen.getByLabelText('Legend');

      await expect.element(legend.getByText('GMOS')).toBeVisible();
      await expect.element(legend.getByText('Altair')).toBeVisible();
      await expect.element(legend.getByText('GHOST')).not.toBeInTheDocument();
      await expect.element(legend.getByText('Closed')).toBeVisible();
    });

    it('gives each instrument its own colour', async () => {
      const screen = await openSemester(
        '/semester?site=GS&semester=2025B',
        publishedSemesters(GS_2025B),
        semesterSchedule(GS_2025B, {
          instrumentAvailability: [
            GHOST,
            GCAL,
            instrumentAvailabilityBlock({ instrument: 'GMOS', port: 3, interval: GS_2025B_WHOLE }),
          ],
          telescopeMode: [telescopeModeBlock({ mode: 'QUEUE', interval: GS_2025B_WHOLE })],
        }),
      );
      await expect.element(screen.getByRole('region', { name: 'September 2025' })).toBeVisible();
      const september = () =>
        screen
          .getByRole('region', { name: 'September 2025' })
          .element()
          // path, not the wrapping <g>: Highcharts puts the class on both and only the path carries the fill.
          .querySelectorAll('path.highcharts-point:not(.schedule-ghost)');
      await expect.poll(() => september().length).toBeGreaterThan(0);

      // The token, not the computed colour: renderApp loads no stylesheet, so var(--instrument-x) is inert.
      const fills = new Set([...september()].map((mark) => mark.getAttribute('fill')));

      // The state rows head the chart in the routine neutral, never an instrument hue.
      expect(fills).toEqual(
        new Set([
          'var(--instrument-ghost)',
          'var(--instrument-gcal)',
          'var(--instrument-gmos)',
          'var(--state-routine)',
        ]),
      );
    });

    it('keys the weekend shading it draws under every month', async () => {
      const screen = await openSemester(
        '/semester?site=GS&semester=2025B',
        publishedSemesters(GS_2025B),
        semesterSchedule(GS_2025B),
      );

      await expect
        .element(screen.getByLabelText('Legend').getByRole('group', { name: 'Calendar' }).getByText('Weekend'))
        .toBeVisible();
    });

    it('draws a telescope shutdown as a band with its key', async () => {
      const screen = await openSemester(
        '/semester?site=GS&semester=2024B',
        publishedSemesters(GS_2024B),
        semesterSchedule(GS_2024B, {
          telescopeAvailability: [
            telescopeAvailabilityBlock({ reason: 'Shutdown', interval: overNights('GS', '2024-08-02', '2024-08-16') }),
          ],
        }),
      );

      await expect.element(screen.getByLabelText('Legend').getByText('Closed')).toBeVisible();
    });

    it('switches to Gemini North, organised by the same five ports', async () => {
      const screen = await openSemester(
        '/semester?site=GN&semester=2026B',
        publishedSemesters(GS_2025B, GN_2026B),
        semesterSchedule(GN_2026B),
      );

      await expect.element(screen.getByText('Gemini North Semester 2026B', { exact: false })).toBeVisible();
      await expect.element(screen.getByRole('region', { name: 'August 2026' })).toBeVisible();
    });

    it('survives a clock change without redrawing a single bar', async () => {
      // The chart speaks dates, so the toggle's re-render must leave every bar exactly where it was.
      const screen = await openSemesterInShell(
        '/semester?site=GN&semester=2026B',
        publishedSemesters(GN_2026B),
        semesterSchedule(GN_2026B, {
          instrumentAvailability: [
            instrumentAvailabilityBlock({ instrument: 'GMOS', port: 1, interval: GN_2026B_WHOLE }),
          ],
        }),
      );
      await expect.element(screen.getByRole('region', { name: 'August 2026' })).toBeVisible();
      await expect.poll(() => drawnBars().length).toBeGreaterThan(0);
      const before = drawnBars();

      await chooseClock(screen, 'UTC');

      await expect.poll(drawnBars).toBe(before);
    });

    it('moves the chart to the semester picked on the page, every month drawn', async () => {
      // The largest window swing the app has, and the only one driven through the control.
      const screen = await openSemester(
        '/semester?site=GS&semester=2025B',
        publishedSemesters(GS_2025A, GS_2025B),
        semesterSchedule(GS_2025B, { instrumentAvailability: [GHOST] }),
        semesterSchedule(GS_2025A, {
          instrumentAvailability: [
            instrumentAvailabilityBlock({
              instrument: 'F2',
              port: 1,
              interval: overNights('GS', '2025-02-02', '2025-08-01'),
            }),
          ],
        }),
      );
      await expect.element(screen.getByRole('region', { name: 'August 2025' })).toBeVisible();
      const bars = () => document.querySelectorAll('[data-testid^="semester-month-"] path.highcharts-point').length;
      await expect.poll(bars).toBeGreaterThan(0);

      // Semester A's evenings run February to July, so February is its first region.
      await selectDropdownOption(screen, 'Semester', '2025A');
      await expect.element(screen.getByRole('region', { name: 'February 2025' })).toBeVisible();
      await expect.poll(bars).toBeGreaterThan(0);

      await selectDropdownOption(screen, 'Semester', '2025B');
      await expect.element(screen.getByRole('region', { name: 'August 2025' })).toBeVisible();
      await expect.poll(bars).toBeGreaterThan(0);
    });

    it('keeps its keyboard stop out of the hidden half, mirror and all', async () => {
      const screen = await openSemester(
        '/semester?site=GS&semester=2025B',
        publishedSemesters(GS_2025B),
        semesterSchedule(GS_2025B),
      );
      await expect.element(screen.getByLabelText('Semester', { exact: true })).toBeInTheDocument();

      const picker = screen.container.querySelector('.xp-page-select')!;
      // PrimeReact wraps the native mirror and the real keyboard stop in the same class, so hiding
      // by wrapper erases the stop: the mirror alone carries `aria-hidden`.
      expect(picker.querySelector('select')?.getAttribute('aria-hidden')).toBe('true');

      const stop = picker.querySelector<HTMLElement>('input')!;
      stop.focus();
      expect(document.activeElement).toBe(stop);
      expect(stop.closest('[aria-hidden="true"]')).toBeNull();
    });

    it('picks a semester without leaving the view it was picked from', async () => {
      const screen = await openSemester(
        '/semester?site=GS&semester=2025B&view=calendar',
        publishedSemesters(GS_2025A, GS_2025B),
        semesterSchedule(GS_2025B),
        semesterSchedule(GS_2025A),
      );
      await expect.element(screen.getByTestId('semester-calendar')).toBeVisible();

      await selectDropdownOption(screen, 'Semester', '2025A');

      // What must change, and what must not: the window moves, the chosen view stays chosen.
      await expect.element(screen.getByRole('button', { name: 'Open night beginning 2025-02-14' })).toBeVisible();
      await expect.element(screen.getByTestId('semester-calendar')).toBeVisible();
      await expect.element(screen.getByTestId('semester-timeline')).not.toBeInTheDocument();
    });

    it('redraws the cached semester when the site switches back, never an empty chart', async () => {
      // Both sites share the month keys, so the switch back updates mounted charts rather than remounting.
      const screen = await openSemesterInShell(
        '/semester?site=GS&semester=2025B',
        publishedSemesters(GS_2025B, GN_2025B),
        semesterSchedule(GS_2025B, { instrumentAvailability: [GHOST] }),
        semesterSchedule(GN_2025B, {
          instrumentAvailability: [
            instrumentAvailabilityBlock({
              instrument: 'GMOS',
              port: 3,
              interval: overNights('GN', '2025-08-02', '2026-02-01'),
            }),
          ],
        }),
      );
      await expect.element(screen.getByText('Gemini South Semester 2025B', { exact: false })).toBeVisible();
      await expect.poll(() => drawnBars().length).toBeGreaterThan(0);
      const southBars = drawnBars();

      await chooseSite(screen, 'GN');
      await expect.element(screen.getByText('Gemini North Semester 2025B', { exact: false })).toBeVisible();
      // Changed before non-empty: a blank chart also passes "changed".
      await expect.poll(drawnBars).not.toBe(southBars);
      await expect.poll(() => drawnBars().length).toBeGreaterThan(0);

      await chooseSite(screen, 'GS');
      await expect.element(screen.getByText('Gemini South Semester 2025B', { exact: false })).toBeVisible();
      await expect.poll(drawnBars).toBe(southBars);
    });

    it('opens the night view when a bar is clicked', async () => {
      const screen = await renderApp({
        element: <SemesterPage />,
        route: '/semester?site=GS&semester=2025B',
        extraRoutes: [NIGHT_ROUTE],
        mocks: [publishedSemesters(GS_2025B), semesterSchedule(GS_2025B, { instrumentAvailability: [GHOST] })],
      });
      await expect.element(screen.getByRole('region', { name: 'August 2025' })).toBeVisible();
      const august = '[data-testid="semester-month-August 2025"]';
      await expect.poll(() => document.querySelector(`${august} .highcharts-point`)).not.toBeNull();

      // Which night a bar's centre lands on is what nightAt pins; the assertion is the jump itself.
      const bar = document.querySelector(`${august} .highcharts-point`);
      const { page } = await import('vitest/browser');
      await page.elementLocator(bar!).click();

      await expect.poll(shownUrl).toMatch(/^\/night\?.*night=2025-08-/);
    });
  });

  describe('the calendar', () => {
    const showCalendar = async (screen: Awaited<ReturnType<typeof openSemester>>) => {
      await screen.getByRole('button', { name: 'Calendar' }).click();
      await expect.element(screen.getByTestId('semester-calendar')).toBeVisible();
    };

    const openGs2025B = (query = '') =>
      openSemester(
        `/semester?site=GS&semester=2025B${query}`,
        publishedSemesters(GS_2025B),
        semesterSchedule(GS_2025B),
      );

    it('opens on the month the semester starts in, not on today', async () => {
      const screen = await openGs2025B();
      await showCalendar(screen);

      await expect.element(screen.getByRole('button', { name: 'Open night beginning 2025-08-14' })).toBeVisible();
    });

    it('is a sendable link: view and month come from the URL', async () => {
      const screen = await openGs2025B('&view=calendar&month=2025-11');

      await expect.element(screen.getByTestId('semester-calendar')).toBeVisible();
      await expect.element(screen.getByRole('button', { name: 'Open night beginning 2025-11-14' })).toBeVisible();
    });

    it('drops the month when leaving the calendar - a chart link carries just the semester', async () => {
      const screen = await openGs2025B('&view=calendar&month=2025-11');
      await expect.element(screen.getByRole('button', { name: 'Open night beginning 2025-11-14' })).toBeVisible();

      await screen.getByRole('button', { name: 'Chart' }).click();
      await expect.element(screen.getByTestId('semester-timeline')).toBeVisible();
      await screen.getByRole('button', { name: 'Calendar' }).click();

      // The chart link had no month to carry, so returning starts from the semester's first month.
      await expect.element(screen.getByRole('button', { name: 'Open night beginning 2025-08-14' })).toBeVisible();
    });

    it('drops the month when the semester changes - it named a page of the old one', async () => {
      const screen = await openSemester(
        '/semester?site=GS&semester=2025B&view=calendar&month=2025-11',
        publishedSemesters(GS_2025A, GS_2025B),
        semesterSchedule(GS_2025B),
        semesterSchedule(GS_2025A),
      );
      await expect.element(screen.getByRole('button', { name: 'Open night beginning 2025-11-14' })).toBeVisible();

      await selectDropdownOption(screen, 'Semester', '2025A');
      await expect.element(screen.getByRole('button', { name: 'Open night beginning 2025-02-14' })).toBeVisible();

      // November belonged to the link that named it, not to the semester control.
      await selectDropdownOption(screen, 'Semester', '2025B');
      await expect.element(screen.getByRole('button', { name: 'Open night beginning 2025-08-14' })).toBeVisible();
    });

    it('reads an unknown month parameter as the first month, never an empty grid', async () => {
      // A stale month from another semester must not strand the reader outside it.
      const screen = await openGs2025B('&view=calendar&month=1999-01');

      await expect.element(screen.getByRole('button', { name: 'Open night beginning 2025-08-14' })).toBeVisible();
    });

    it('jumps straight to any month from the picker', async () => {
      const screen = await openGs2025B();
      await showCalendar(screen);

      await selectDropdownOption(screen, 'Month', 'January 2026');

      // A January-only night proves the grid moved with the picker.
      await expect.element(screen.getByRole('button', { name: 'Open night beginning 2026-01-15' })).toBeVisible();
    });

    it('shows the moon and the length of the night, which no other view carries', async () => {
      const screen = await openGs2025B();
      await showCalendar(screen);

      await expect.element(screen.getByTestId('moon-disc').first()).toBeVisible();
      await expect.element(screen.getByText(/^\d+\.\d h$/).first()).toBeVisible();
    });

    it('draws the news as single-evening chips, never the steady run bars', async () => {
      // Altair and GMOS-N run the whole semester and are furniture; drawing them here would bury the news.
      const swap = '2026-09-11';
      const screen = await openSemester(
        '/semester?site=GN&semester=2026B&view=calendar&month=2026-09',
        publishedSemesters(GN_2026B),
        semesterSchedule(GN_2026B, {
          instrumentAvailability: [
            instrumentAvailabilityBlock({
              instrument: 'ALTAIR',
              publishedName: 'Altair',
              port: 3,
              interval: GN_2026B_WHOLE,
            }),
            instrumentAvailabilityBlock({
              instrument: 'GMOS',
              publishedName: 'GMOS-N',
              port: 5,
              interval: GN_2026B_WHOLE,
            }),
            instrumentAvailabilityBlock({
              instrument: 'IGRINS2',
              publishedName: 'IGRINS-2',
              port: 2,
              interval: overNights('GN', '2026-08-02', '2026-09-10'),
            }),
            instrumentAvailabilityBlock({
              instrument: 'MAROON_X',
              publishedName: 'MAROON-X',
              port: 2,
              interval: overNights('GN', swap, '2027-02-01'),
            }),
          ],
        }),
      );
      const calendar = screen.getByTestId('semester-calendar');

      await expect.element(calendar.getByText('IGRINS-2 → MAROON-X').first()).toBeVisible();
      await expect.element(calendar.getByText('Altair')).not.toBeInTheDocument();
      await expect.element(calendar.getByText('GMOS-N')).not.toBeInTheDocument();
    });

    it('chips a usability change by the new usage - the restriction is the news', async () => {
      // A Not Available spell starting and ending inside the semester: one chip for each edge.
      const gnirs = (usage: 'SCIENCE' | 'UNAVAILABLE', firstNight: string, lastNight: string) =>
        instrumentAvailabilityBlock({
          instrument: 'GNIRS',
          usage,
          port: 1,
          interval: overNights('GN', firstNight, lastNight),
        });
      const screen = await openSemester(
        '/semester?site=GN&semester=2026B&view=calendar&month=2026-09',
        publishedSemesters(GN_2026B),
        semesterSchedule(GN_2026B, {
          instrumentAvailability: [
            gnirs('SCIENCE', '2026-08-02', '2026-09-08'),
            gnirs('UNAVAILABLE', '2026-09-09', '2026-09-20'),
            gnirs('SCIENCE', '2026-09-21', '2027-02-01'),
          ],
        }),
      );
      const calendar = screen.getByTestId('semester-calendar');

      await expect.element(calendar.getByText('GNIRS: Not available').first()).toBeVisible();
      await expect.element(calendar.getByText('GNIRS: Science').first()).toBeVisible();
    });

    it('chips the telescope closing and reopening, with the closed squares washed', async () => {
      // The closure sits strictly inside the semester, so both edges are news; the span itself is wash.
      const screen = await openSemester(
        '/semester?site=GN&semester=2026B&view=calendar&month=2026-10',
        publishedSemesters(GN_2026B),
        semesterSchedule(GN_2026B, {
          telescopeAvailability: [
            telescopeAvailabilityBlock({ interval: overNights('GN', '2026-10-21', '2026-10-24') }),
          ],
        }),
      );
      const calendar = screen.getByTestId('semester-calendar');

      await expect.element(calendar.getByText('Closed').first()).toBeVisible();
      await expect.element(calendar.getByText('Open').first()).toBeVisible();
      expect(document.querySelectorAll('.rbc-day-bg.night-closed').length).toBeGreaterThan(0);
    });

    it('will not page out of the semester, where an empty grid would read as closed', async () => {
      const screen = await openGs2025B();
      await showCalendar(screen);

      await expect.element(screen.getByRole('button', { name: 'Previous month' })).toBeDisabled();
    });

    it('carries the closure reason on the closed square itself, not just its header', async () => {
      const screen = await openSemester(
        '/semester?site=GS&semester=2024B&view=calendar',
        publishedSemesters(GS_2024B),
        semesterSchedule(GS_2024B, {
          telescopeAvailability: [
            telescopeAvailabilityBlock({ reason: 'Shutdown', interval: overNights('GS', '2024-08-02', '2024-08-16') }),
          ],
        }),
      );
      await expect.element(screen.getByRole('button', { name: 'Open night beginning 2024-08-02' })).toBeVisible();

      // A closed square is mostly wash, so hovering anywhere on it must still surface the reason.
      const closed = [...document.querySelectorAll('.rbc-day-bg.night-closed')];
      expect(closed.length).toBeGreaterThan(0);
      for (const square of closed) {
        expect(square.getAttribute('title')).toContain('Shutdown');
      }
    });

    it('opens the night view when a night is clicked', async () => {
      const screen = await renderApp({
        element: <SemesterPage />,
        route: '/semester?site=GS&semester=2025B',
        extraRoutes: [NIGHT_ROUTE],
        mocks: [publishedSemesters(GS_2025B), semesterSchedule(GS_2025B)],
      });
      await showCalendar(screen);

      // The whole square is the link; the date header is its accessible name.
      await screen.getByRole('button', { name: 'Open night beginning 2025-08-14' }).click();

      await expect.poll(shownUrl).toMatch(/^\/night\?.*night=2025-08-15/);
    });

    it('replaces the chart rather than joining it', async () => {
      const screen = await openGs2025B();
      await showCalendar(screen);

      await expect.element(screen.getByTestId('semester-timeline')).not.toBeInTheDocument();
    });

    it('keeps the block table, which is the reading for every view', async () => {
      const screen = await openGs2025B();
      await showCalendar(screen);

      await expect.element(screen.getByTestId('semester-block-table')).toBeInTheDocument();
    });
  });

  /** Not a view, so it must be present whichever picture is drawn. */
  describe('the block table', () => {
    it('states a run once, with its extent, rather than once per night', async () => {
      const screen = await openSemester(
        '/semester?site=GS&semester=2025B',
        publishedSemesters(GS_2025B),
        semesterSchedule(GS_2025B, { instrumentAvailability: [GHOST] }),
      );

      const table = screen.getByTestId('semester-block-table');
      await expect.element(table).toBeInTheDocument();
      // GHOST is one block from August to January, so it is one row: the point of a block table.
      await expect.element(table.getByRole('row', { name: /Port 1 GHOST 1 Aug 2025/ })).toBeInTheDocument();
    });

    it('files a telescope-wide closure under no port, with the whole phrase', async () => {
      const screen = await openSemester(
        '/semester?site=GS&semester=2024B',
        publishedSemesters(GS_2024B),
        semesterSchedule(GS_2024B, {
          telescopeAvailability: [
            telescopeAvailabilityBlock({ reason: 'Shutdown', interval: overNights('GS', '2024-08-02', '2024-08-16') }),
          ],
        }),
      );

      await expect
        .element(screen.getByTestId('semester-block-table').getByRole('row', { name: /Whole telescope/ }))
        .toBeInTheDocument();
    });
  });

  /** Chart and calendar each derive the week boundary themselves, so a one-night drift is possible. */
  describe('the week boundary both views draw', () => {
    const EVENING_PREFIX = 'Open night beginning ';

    /** The evening date a calendar square opens, or null for one outside the semester. */
    const eveningOf = (cell: Element): string | null =>
      cell
        .querySelector(`[aria-label^="${EVENING_PREFIX}"]`)
        ?.getAttribute('aria-label')
        ?.slice(EVENING_PREFIX.length) ?? null;

    it('emphasises the nights the calendar puts in its first column', async () => {
      const screen = await openSemester(
        '/semester?site=GS&semester=2025B&view=calendar&month=2025-11',
        publishedSemesters(GS_2025B),
        semesterSchedule(GS_2025B),
      );
      await expect.element(screen.getByRole('button', { name: 'Open night beginning 2025-11-14' })).toBeVisible();

      // Only the evening dates matter here, so it needs no records.
      const november = buildSemesterTimeline({
        site: 'GS',
        firstNight: '2025-11-02',
        lastNight: '2025-12-01',
        mountings: [],
        closures: [],
      }).months[0]!;
      const monthEvenings = new Set(november.nights.map((night) => night.eveningDate));

      const lines = buildMonthLines(november);
      const chartWeekStarts = new Set(
        november.nights
          .filter((night) =>
            lines.some((line) => line.value === night.interval.start && line.color === 'var(--schedule-week-line)'),
          )
          .map((night) => night.eveningDate),
      );

      // The grid reaches into neighbouring months, hence the restriction to the evenings this chart drew.
      const cells = [...document.querySelectorAll('.rbc-date-cell')];
      expect(cells.length % 7).toBe(0);
      const calendarWeekStarts = new Set(
        cells
          .filter((_, index) => index % 7 === 0)
          .map(eveningOf)
          .filter(isNotNullish)
          .filter((evening) => monthEvenings.has(evening)),
      );

      // Non-empty first: two empty sets agree about nothing.
      expect(calendarWeekStarts.size).toBeGreaterThan(3);
      expect(chartWeekStarts).toEqual(calendarWeekStarts);
    });
  });

  describe('the window it asks for', () => {
    it('asks over the observing nights, not the calendar days they are labelled by', async () => {
      // The two ends sit in different offsets, so a calendar-day window is wrong at both and no offset fixes it.
      // Only this window is answered, so a page asking for any other draws no GHOST.
      const screen = await openSemester(
        '/semester?site=GS&semester=2025B',
        publishedSemesters(GS_2025B),
        semesterSchedule(
          { site: 'GS', interval: { start: '2025-08-01T18:00:00.000Z', end: '2026-02-01T17:00:00.000Z' } },
          { instrumentAvailability: [GHOST] },
        ),
      );

      await expect
        .element(screen.getByTestId('semester-block-table').getByRole('row', { name: /GHOST/ }))
        .toBeInTheDocument();
    });
  });

  describe('every published semester', () => {
    it('opens any semester Resource publishes, not only the latest', async () => {
      const screen = await openSemester(
        '/semester?site=GS&semester=2025A',
        publishedSemesters(GS_2024B, GS_2025A, GS_2025B),
        semesterSchedule(GS_2025A),
      );

      await expect.element(screen.getByText('Gemini South Semester 2025A', { exact: false })).toBeVisible();
    });
  });

  describe('the demo suffix', () => {
    /** One real GS semester and one synthetic, so the picker's "(demo)" suffix has something to prove. */
    const GS_2026B_DEMO = publishedSemester({ site: 'GS', semester: '2026B', demo: true });

    const openWithOneDemo = (...mocks: MockLink.MockedResponse[]) =>
      openSemester(
        '/semester?site=GS&semester=2025B',
        publishedSemesters(GS_2025B, GS_2026B_DEMO),
        semesterSchedule(GS_2025B),
        ...mocks,
      );

    it('flags a synthetic option in the picker without marking the real one beside it', async () => {
      const screen = await openWithOneDemo();
      await expect.element(screen.getByText('Gemini South Semester 2025B', { exact: false })).toBeVisible();

      await openDropdown(screen, 'Semester');

      const options = [...document.querySelectorAll('[role="option"]')].map((option) => option.textContent ?? '');
      expect(options).toEqual(['2025B', '2026B (demo)']);
    });

    it('carries the demo tag through once picked', async () => {
      const screen = await openWithOneDemo(semesterSchedule(GS_2026B_DEMO));
      await expect.element(screen.getByText('Gemini South Semester 2025B', { exact: false })).toBeVisible();
      await expect.element(screen.getByTestId('synthetic-data-tag')).not.toBeInTheDocument();

      await selectDropdownOption(screen, 'Semester', '2026B (demo)');

      await expect.element(screen.getByText('Gemini South Semester 2026B', { exact: false })).toBeVisible();
      await expect.element(screen.getByTestId('synthetic-data-tag')).toBeVisible();
    });
  });
});
