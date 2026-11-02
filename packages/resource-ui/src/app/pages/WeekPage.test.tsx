import type { MockLink } from '@apollo/client/testing';
import Highcharts from 'highcharts/es-modules/masters/highcharts.src.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';

import { addDays } from '@/domain/semester';
import { HOUR_MS, observingNightInterval, observingNightOf } from '@/domain/siteTime';
import { drawnBars, drawnPlotLineX } from '@/test/chartProbe';
import { instrumentAvailabilityBlock, overNights } from '@/test/fixtures/blocks';
import { publishedSemester, wholeSemester } from '@/test/fixtures/semester';
import { type WeekRow, weekSchedule } from '@/test/fixtures/week';
import { fakeClock } from '@/test/helpers';
import { probeRoute, shownUrl } from '@/test/probe';
import { renderWithRoute } from '@/test/render';

import WeekPage from './WeekPage';

const GS_2025B_WHOLE = wholeSemester(publishedSemester({ site: 'GS', semester: '2025B' }));
const GHOST = instrumentAvailabilityBlock({ instrument: 'GHOST', at: { port: 1 }, interval: GS_2025B_WHOLE });

const weekUrl = ({ site, night }: WeekRow) => `/week?site=${site}&night=${night}`;

const openWeek = (route: string, ...mocks: MockLink.MockedResponse[]) =>
  renderWithRoute(<WeekPage />, { route, extraRoutes: [probeRoute('/night')], mocks });

/** The week a row names, answered with its blocks; the URL is not the subject here. */
const openWeekOf = (row: WeekRow, blocks?: Parameters<typeof weekSchedule>[1], ...more: MockLink.MockedResponse[]) =>
  openWeek(weekUrl(row), weekSchedule(row, blocks), ...more);

const ORDINARY_WEEK: WeekRow = { site: 'GS', night: '2025-11-14' };

/** The ordinary week most tests open. */
const openOrdinaryWeek = (...more: MockLink.MockedResponse[]) =>
  openWeekOf(ORDINARY_WEEK, { instrumentAvailability: [GHOST] }, ...more);

const weekOf = (night: string): string[] => Array.from({ length: 7 }, (_, index) => addDays(night, index));

const chartBars = () => drawnBars('[data-testid="week-timeline"]');

afterEach(() => {
  vi.useRealTimers();
});

describe(WeekPage, () => {
  it('keeps the chart options across a tick: the marker moves and chart.update never runs', async () => {
    fakeClock(observingNightInterval('GS', '2025-11-15').start + 6 * HOUR_MS, { shouldAdvanceTime: true });
    const update = vi.spyOn(Highcharts.Chart.prototype, 'update');
    await openOrdinaryWeek();
    await expect.poll(() => drawnPlotLineX('.schedule-today')).toHaveLength(1);
    const [before] = drawnPlotLineX('.schedule-today');
    const updates = update.mock.calls.length;

    vi.advanceTimersByTime(24 * HOUR_MS);

    await expect.poll(() => drawnPlotLineX('.schedule-today')[0]).toBeGreaterThan(before ?? Number.NaN);
    expect(update.mock.calls.length).toBe(updates);
  });

  it('draws seven nights from the one asked for', async () => {
    const screen = await openOrdinaryWeek();

    // The URL carries the night label; the page speaks the evening each night begins.
    await expect.element(screen.getByText('Nights beginning 2025-11-13 to 2025-11-19')).toBeVisible();
    await expect.element(screen.getByTestId('week-timeline')).toBeVisible();
  });

  it('heads each night by the evening it begins on', async () => {
    const screen = await openOrdinaryWeek();

    // The night labelled the 14th begins on Thursday the 13th.
    await expect.element(screen.getByText('Thu 13').first()).toBeVisible();
    await expect.element(screen.getByText('Wed 19').first()).toBeVisible();
  });

  it('marks the night the backend holds nothing for as not recorded, and only that night', async () => {
    const screen = await openWeekOf(ORDINARY_WEEK, { instrumentAvailability: [GHOST], withoutData: ['2025-11-16'] });

    await expect.poll(() => screen.getByTestId('week-timeline').getByText('not recorded').elements().length).toBe(1);
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
      at: { port: 1 },
      interval: overNights('GS', '2024-08-02', '2024-08-14'),
    });
    const gmos = instrumentAvailabilityBlock({
      instrument: 'GMOS',
      at: { port: 1 },
      interval: overNights('GS', '2024-08-15', '2024-09-30'),
    });
    const screen = await openWeekOf(
      { site: 'GS', night: '2024-08-12' },
      { instrumentAvailability: [ghost, gmos] },
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

  it('jumps back to the week that starts tonight from a deep link', async () => {
    // Derived with the page's own functions: Tonight is the one control that follows the wall clock.
    const tonight = observingNightOf('GS', Date.now());
    const screen = await openOrdinaryWeek(weekSchedule({ site: 'GS', night: tonight }));

    await screen.getByRole('button', { name: 'Tonight' }).click();

    await expect
      .element(screen.getByText(`Nights beginning ${addDays(tonight, -1)} to ${addDays(tonight, 5)}`))
      .toBeVisible();
  });

  it('picks the week by the evening it begins, in the same vocabulary as the heading', async () => {
    const screen = await openOrdinaryWeek(weekSchedule({ site: 'GS', night: '2025-11-21' }));

    const input = screen.getByLabelText('First evening');
    await input.fill('2025-11-20');

    await expect.element(screen.getByText('Nights beginning 2025-11-20 to 2025-11-26')).toBeVisible();
  });

  it('keys the colours to the instruments the week actually holds', async () => {
    const screen = await openWeekOf(ORDINARY_WEEK, {
      instrumentAvailability: [
        GHOST,
        instrumentAvailabilityBlock({ instrument: 'GMOS', at: { port: 3 }, interval: GS_2025B_WHOLE }),
      ],
    });
    const legend = screen.getByLabelText('Legend');

    await expect.element(legend.getByText('GHOST')).toBeVisible();
    await expect.element(legend.getByText('GMOS')).toBeVisible();
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

  it('says nothing is recorded for a week the backend holds nothing for, in place of the chart', async () => {
    const screen = await openWeekOf({ site: 'GS', night: '2030-01-01' }, { withoutData: weekOf('2030-01-01') });

    await expect.element(screen.getByText('Nothing is recorded for this week.')).toBeVisible();
    await expect.element(screen.getByTestId('week-timeline')).not.toBeInTheDocument();
    await expect.element(screen.getByLabelText('Legend')).not.toBeInTheDocument();
  });
});
