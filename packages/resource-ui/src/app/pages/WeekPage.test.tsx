import type { MockLink } from '@apollo/client/testing';
import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';

import { setClockPreference } from '@/app/useClockPreference';
import { addDays } from '@/domain/semester';
import { observingNightOf } from '@/domain/siteTime';
import {
  instrumentAvailabilityBlock,
  overNights,
  telescopeAvailabilityBlock,
  telescopeModeBlock,
  tooSupportBlock,
} from '@/test/fixtures/blocks';
import { instrumentComponent, instrumentComponentAvailabilityBlock } from '@/test/fixtures/components';
import { publishedSemester, publishedSemesters } from '@/test/fixtures/semester';
import { weekSchedule } from '@/test/fixtures/week';
import { Probe, PROBE_URL_TESTID } from '@/test/probe';
import { renderApp } from '@/test/renderApp';

import WeekPage from './WeekPage';

const GS_2024B = publishedSemester({ site: 'GS', semester: '2024B' });
const GS_2025B = publishedSemester({ site: 'GS', semester: '2025B' });

const GS_2025B_WHOLE = overNights('GS', '2025-08-02', '2026-02-01');
const GHOST = instrumentAvailabilityBlock({ instrument: 'GHOST', port: 1, interval: GS_2025B_WHOLE });

/** Stand in for the views a link opens: the subject is the jump, not what they draw. */
const LINK_TARGETS = [
  { path: '/night', element: <Probe use={() => null} /> },
  { path: '/semester', element: <Probe use={() => null} /> },
];

const shownUrl = () => document.querySelector(`[data-testid="${PROBE_URL_TESTID}"]`)?.textContent ?? '';

const openWeek = (route: string, ...mocks: MockLink.MockedResponse[]) =>
  renderApp({ element: <WeekPage />, route, extraRoutes: LINK_TARGETS, mocks });

/** The ordinary week most tests open. */
const openOrdinaryWeek = (...more: MockLink.MockedResponse[]) =>
  openWeek(
    '/week?site=GS&night=2025-11-14',
    publishedSemesters(GS_2025B),
    weekSchedule({ site: 'GS', night: '2025-11-14' }, { instrumentAvailability: [GHOST] }),
    ...more,
  );

const weekOf = (night: string): string[] => Array.from({ length: 7 }, (_, index) => addDays(night, index));

const chartBars = () =>
  [...document.querySelectorAll('[data-testid="week-timeline"] path.highcharts-point')]
    .map((point) => `${point.getAttribute('d') ?? ''}#${point.getAttribute('fill') ?? ''}`)
    .join('|');

/** The R400 leaves its slot for the summit lab at 00:00 site time inside the night labelled 2025-11-20. */
const R400_FAILS = instrumentComponentAvailabilityBlock({
  component: instrumentComponent({ name: 'R400' }),
  location: 'LAB',
  usage: 'UNAVAILABLE',
  note: 'Failed; removed for repair',
  interval: { __typename: 'TimestampInterval', start: '2025-11-20T03:00:00.000Z', end: '2026-01-15T17:00:00.000Z' },
});

const openWeekOfR400Failure = () =>
  openWeek(
    '/week?site=GS&night=2025-11-20',
    publishedSemesters(GS_2025B),
    weekSchedule({ site: 'GS', night: '2025-11-20' }, { instrumentComponentAvailability: [R400_FAILS] }),
  );

describe(WeekPage, () => {
  it('draws seven nights from the one asked for', async () => {
    const screen = await openOrdinaryWeek();

    // The URL carries the night label; the page speaks the evening each night begins, and says so.
    await expect.element(screen.getByText('Nights beginning 2025-11-13 to 2025-11-19')).toBeVisible();
    await expect.element(screen.getByText('headed by the date each night begins', { exact: false })).toBeVisible();
    await expect.element(screen.getByTestId('week-timeline')).toBeVisible();
  });

  it('heads each night by the evening it begins on', async () => {
    const screen = await openOrdinaryWeek();

    // The night labelled the 14th begins on Thursday the 13th.
    await expect.element(screen.getByText('Thu 13').first()).toBeVisible();
    await expect.element(screen.getByText('Wed 19').first()).toBeVisible();
  });

  it('heads the chart with the telescope-state rows, their values keyed in sections', async () => {
    const screen = await openWeek(
      '/week?site=GS&night=2025-11-14',
      publishedSemesters(GS_2025B),
      weekSchedule(
        { site: 'GS', night: '2025-11-14' },
        {
          instrumentAvailability: [GHOST],
          telescopeAvailability: [telescopeAvailabilityBlock({ interval: GS_2025B_WHOLE, availability: 'OPEN' })],
          telescopeMode: [telescopeModeBlock({ interval: GS_2025B_WHOLE })],
          tooSupport: [tooSupportBlock({ interval: GS_2025B_WHOLE })],
        },
      ),
    );

    await expect.element(screen.getByRole('group', { name: 'Telescope' }).getByText('Open')).toBeVisible();
    await expect.element(screen.getByRole('group', { name: 'Mode' }).getByText('Queue')).toBeVisible();
    await expect.element(screen.getByRole('group', { name: 'ToO' }).getByText('Standard ToOs')).toBeVisible();
    await expect.element(screen.getByRole('group', { name: 'Instruments' }).getByText('GHOST')).toBeVisible();
  });

  it('marks the night the backend holds nothing for as not recorded, and only that night', async () => {
    const screen = await openWeek(
      '/week?site=GS&night=2025-11-14',
      publishedSemesters(GS_2025B),
      weekSchedule(
        { site: 'GS', night: '2025-11-14' },
        { instrumentAvailability: [GHOST], withoutData: ['2025-11-16'] },
      ),
    );

    await expect
      .element(screen.getByRole('button', { name: 'Open night beginning 2025-11-15' }).getByText('not recorded'))
      .toBeVisible();
    await expect.poll(() => [...document.querySelectorAll('[data-testid="week-night-facts"] .p-tag')].length).toBe(1);
  });

  it('steps a whole week at a time', async () => {
    const screen = await openOrdinaryWeek(weekSchedule({ site: 'GS', night: '2025-11-21' }));

    await screen.getByRole('button', { name: 'Next week' }).click();
    await expect.element(screen.getByText('Nights beginning 2025-11-20 to 2025-11-26')).toBeVisible();

    await screen.getByRole('button', { name: 'Previous week' }).click();
    await expect.element(screen.getByText('Nights beginning 2025-11-13 to 2025-11-19')).toBeVisible();
  });

  it('steps a week away and back, redrawing the cached week in place', async () => {
    // A run ending inside the first week, so the two windows draw different bars.
    const ghost = instrumentAvailabilityBlock({
      instrument: 'GHOST',
      port: 1,
      interval: overNights('GS', '2024-08-02', '2024-08-14'),
    });
    const gmos = instrumentAvailabilityBlock({
      instrument: 'GMOS',
      port: 1,
      interval: overNights('GS', '2024-08-15', '2024-09-30'),
    });
    const screen = await openWeek(
      '/week?site=GS&night=2024-08-12',
      publishedSemesters(GS_2024B),
      weekSchedule({ site: 'GS', night: '2024-08-12' }, { instrumentAvailability: [ghost, gmos] }),
      weekSchedule({ site: 'GS', night: '2024-08-19' }, { instrumentAvailability: [gmos] }),
    );
    await expect.poll(() => chartBars().length).toBeGreaterThan(0);
    const homeBars = chartBars();

    await screen.getByRole('button', { name: 'Next week' }).click();
    await expect.element(screen.getByText('Nights beginning 2024-08-18 to 2024-08-24')).toBeVisible();
    // Changed before non-empty: a blank chart also passes "changed".
    await expect.poll(chartBars).not.toBe(homeBars);
    await expect.poll(() => chartBars().length).toBeGreaterThan(0);

    await screen.getByRole('button', { name: 'Previous week' }).click();
    await expect.element(screen.getByText('Nights beginning 2024-08-11 to 2024-08-17')).toBeVisible();
    await expect.poll(chartBars).toBe(homeBars);
  });

  it('links the semester it belongs to - the reverse of the calendar click-through', async () => {
    const screen = await openOrdinaryWeek();

    await screen.getByRole('link', { name: 'Gemini South Semester 2025B', exact: false }).click();

    await expect.poll(shownUrl).toBe('/semester?site=GS&night=2025-11-14&semester=2025B');
  });

  it('jumps back to the week that starts tonight from a deep link', async () => {
    // Derived with the page's own functions: Tonight is the one control that follows the wall clock.
    const tonight = observingNightOf('GS', Date.now());
    const screen = await openOrdinaryWeek(weekSchedule({ site: 'GS', night: tonight }));

    await screen.getByRole('button', { name: 'Tonight' }).click();

    await expect
      .element(screen.getByText(`Nights beginning ${addDays(tonight, -1)} to ${addDays(tonight, 5)}`))
      .toBeVisible();
    await expect.element(screen.getByRole('button', { name: 'Tonight' })).toBeDisabled();
  });

  it('picks the week by the evening it begins, in the same vocabulary as the heading', async () => {
    const screen = await openOrdinaryWeek(weekSchedule({ site: 'GS', night: '2025-11-21' }));

    const input = screen.getByLabelText('First evening');
    await expect.element(input).toHaveValue('2025-11-13');

    await input.fill('2025-11-20');

    await expect.element(screen.getByText('Nights beginning 2025-11-20 to 2025-11-26')).toBeVisible();
  });

  it('briefs each night: dark hours, moon, and the week’s totals', async () => {
    const screen = await openOrdinaryWeek();

    await expect.poll(() => document.querySelectorAll('[data-testid="week-night-facts"]').length).toBe(7);
    await expect.element(screen.getByText('h dark', { exact: false }).first()).toBeVisible();
    await expect.element(screen.getByText('% moon', { exact: false }).first()).toBeVisible();
    await expect.element(screen.getByText('h of astronomical dark', { exact: false })).toBeVisible();
  });

  it('lists what changes this week, with the clock time of a mid-night change', async () => {
    const screen = await openWeekOfR400Failure();

    const changes = screen.getByTestId('week-changes');
    await expect.element(changes.getByText('R400 to Summit lab')).toBeVisible();
    await expect.element(changes.getByText('Failed; removed for repair')).toBeVisible();
    await expect.element(changes.getByText('00:00', { exact: false })).toBeVisible();
  });

  it('phrases the change instants in UT when the reader keeps the UT clock', async () => {
    // The same R400 failure: 00:00 at the site is 03:00 UT in November (UTC-3).
    setClockPreference('utc');
    const screen = await openWeekOfR400Failure();

    const changes = screen.getByTestId('week-changes');
    await expect.element(changes.getByText('03:00', { exact: false })).toBeVisible();
  });

  it('says so plainly when nothing changes all week', async () => {
    // Every run carries straight through the week, so no record begins or ends inside it.
    const screen = await openOrdinaryWeek();

    await expect.element(screen.getByText('Nothing changes this week', { exact: false })).toBeVisible();
    await expect.element(screen.getByTestId('week-changes')).not.toBeInTheDocument();
  });

  it('keys the chrome as well as the data: the sky it paints and the weekends it shades', async () => {
    const screen = await openOrdinaryWeek();
    const legend = screen.getByLabelText('Legend');

    await expect.element(legend.getByRole('group', { name: 'Sky' }).getByText('Daylight')).toBeVisible();
    await expect.element(legend.getByRole('group', { name: 'Calendar' }).getByText('Weekend')).toBeVisible();
  });

  it('keys the colours to the instruments the week actually holds', async () => {
    const screen = await openWeek(
      '/week?site=GS&night=2025-11-14',
      publishedSemesters(GS_2025B),
      weekSchedule(
        { site: 'GS', night: '2025-11-14' },
        {
          instrumentAvailability: [
            GHOST,
            instrumentAvailabilityBlock({ instrument: 'GMOS', port: 3, interval: GS_2025B_WHOLE }),
          ],
        },
      ),
    );
    const legend = screen.getByLabelText('Legend');

    await expect.element(legend.getByText('GHOST')).toBeVisible();
    await expect.element(legend.getByText('GMOS')).toBeVisible();
  });

  it('opens the night view from a facts card', async () => {
    const screen = await openOrdinaryWeek();

    // The card headed "Thu 13" is the night labelled the 14th; the whole card is the link.
    await screen.getByRole('button', { name: 'Open night beginning 2025-11-13' }).click();

    await expect.poll(shownUrl).toBe('/night?site=GS&night=2025-11-14');
  });

  it('opens the night view from the chart', async () => {
    const screen = await openOrdinaryWeek();
    await expect.element(screen.getByTestId('week-timeline')).toBeVisible();
    await expect.poll(() => document.querySelector('[data-testid="week-timeline"] .highcharts-point')).not.toBeNull();

    // Which night a bar's centre lands on is what `nightAt` pins; the assertion is the jump itself.
    const bar = document.querySelector('[data-testid="week-timeline"] .highcharts-point');
    await page.elementLocator(bar!).click();

    await expect.poll(shownUrl).toMatch(/^\/night\?site=GS&night=2025-11-(1[4-9]|20)$/);
  });

  it('keeps the tag off a published week', async () => {
    const screen = await openOrdinaryWeek();

    await expect.element(screen.getByTestId('week-timeline')).toBeVisible();
    await expect.element(screen.getByTestId('synthetic-data-tag')).not.toBeInTheDocument();
  });

  it('says so when no published schedule reaches the week', async () => {
    const screen = await openWeek(
      '/week?site=GS&night=2030-01-01',
      publishedSemesters(GS_2025B),
      weekSchedule({ site: 'GS', night: '2030-01-01' }, { withoutData: weekOf('2030-01-01') }),
    );

    await expect.element(screen.getByText('No published schedule covers these nights', { exact: false })).toBeVisible();
    await expect.element(screen.getByTestId('week-timeline')).not.toBeInTheDocument();
  });
});
