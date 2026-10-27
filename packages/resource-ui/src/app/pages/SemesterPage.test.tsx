import type { MockLink } from '@apollo/client/testing';
import { openDropdown, selectDropdownOption } from '@gemini-hlsw/lucuma-common-ui/testing';
import { describe, expect, it } from 'vitest';

import Layout from '@/components/layout/Layout';
import {
  instrumentAvailabilityBlock,
  overNights,
  telescopeAvailabilityBlock,
  telescopeModeBlock,
} from '@/test/fixtures/blocks';
import { publishedSemester, publishedSemesters, semesterSchedule } from '@/test/fixtures/semester';
import { chooseClock, chooseSite } from '@/test/helpers';
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
    it("opens an old calendar link on that semester's timeline", async () => {
      const screen = await openSemester(
        '/semester?site=GS&semester=2025B&view=calendar&month=2025-11',
        publishedSemesters(GS_2025B),
        semesterSchedule(GS_2025B),
      );

      await expect.element(screen.getByText('Gemini South Semester 2025B', { exact: false })).toBeVisible();
      await expect.element(screen.getByRole('region', { name: 'November 2025' })).toBeVisible();
    });

    it('opens on the chart, one block per month', async () => {
      const screen = await openSemester(
        '/semester?site=GS&semester=2025B',
        publishedSemesters(GS_2025B),
        semesterSchedule(GS_2025B),
      );

      await expect.element(screen.getByText('Gemini South Semester 2025B', { exact: false })).toBeVisible();
      await expect.element(screen.getByTestId('semester-timeline')).toBeVisible();
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
      await selectDropdownOption(screen, { label: 'Semester' }, '2025A');
      await expect.element(screen.getByRole('region', { name: 'February 2025' })).toBeVisible();
      await expect.poll(bars).toBeGreaterThan(0);

      await selectDropdownOption(screen, { label: 'Semester' }, '2025B');
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

  describe('the window it asks for', () => {
    it('asks over the observing nights, not the calendar days they are labelled by', async () => {
      // The two ends sit in different offsets, so a calendar-day window is wrong at both and no offset fixes it.
      // Only this window is answered, so a page asking for any other draws no GHOST.
      const screen = await openSemester(
        '/semester?site=GS&semester=2025B',
        publishedSemesters(GS_2025B),
        semesterSchedule(
          { site: 'GS', start: '2025-08-01T18:00:00.000Z', end: '2026-02-01T17:00:00.000Z' },
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

      await openDropdown(screen, { label: 'Semester' });

      const options = [...document.querySelectorAll('[role="option"]')].map((option) => option.textContent ?? '');
      expect(options).toEqual(['2025B', '2026B (demo)']);
    });

    it('carries the demo tag through once picked', async () => {
      const screen = await openWithOneDemo(semesterSchedule(GS_2026B_DEMO));
      await expect.element(screen.getByText('Gemini South Semester 2025B', { exact: false })).toBeVisible();
      await expect.element(screen.getByTestId('synthetic-data-tag')).not.toBeInTheDocument();

      await selectDropdownOption(screen, { label: 'Semester' }, '2026B (demo)');

      await expect.element(screen.getByText('Gemini South Semester 2026B', { exact: false })).toBeVisible();
      await expect.element(screen.getByTestId('synthetic-data-tag')).toBeVisible();
    });
  });
});
