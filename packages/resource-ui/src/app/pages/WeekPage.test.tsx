import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';

import { addDays } from '@/domain/semester';
import { observingNightOf } from '@/domain/siteTime';
import { renderApp } from '@/test/renderApp';

import NightPage from './NightPage';
import SemesterPage from './SemesterPage';
import WeekPage from './WeekPage';

const openWeek = async (route: string) =>
  renderApp({
    element: <WeekPage />,
    route,
    extraRoutes: [
      { path: '/night', element: <NightPage /> },
      { path: '/semester', element: <SemesterPage /> },
    ],
  });

describe(WeekPage, () => {
  it('draws seven nights from the one asked for', async () => {
    const screen = await openWeek('/week?site=GS&night=2025-11-14');

    // The URL carries the observing-night label; the page speaks the evening
    // each night begins, one vocabulary with its axis and cards, and says so.
    await expect.element(screen.getByText('Nights beginning 2025-11-13 to 2025-11-19')).toBeVisible();
    await expect.element(screen.getByText('headed by the date each night begins', { exact: false })).toBeVisible();
    await expect.element(screen.getByTestId('week-timeline')).toBeVisible();
  });

  it('heads each night by the evening it begins on', async () => {
    const screen = await openWeek('/week?site=GS&night=2025-11-14');

    // The night labelled the 14th begins on Thursday the 13th.
    await expect.element(screen.getByText('Thu 13').first()).toBeVisible();
    await expect.element(screen.getByText('Wed 19').first()).toBeVisible();
  });

  it('heads the chart with the telescope-state rows, their values keyed in sections', async () => {
    const screen = await openWeek('/week?site=GS&night=2025-11-14');

    // The workbook records Open and Queue across these nights, and the demo
    // assumes Standard ToO support; the state rows head the chart and each
    // legend section keys its own values in the blocks' words.
    await expect.element(screen.getByRole('group', { name: 'Telescope' }).getByText('Open')).toBeVisible();
    await expect.element(screen.getByRole('group', { name: 'Mode' }).getByText('Queue')).toBeVisible();
    await expect.element(screen.getByRole('group', { name: 'ToO' }).getByText('Standard ToOs')).toBeVisible();
    await expect.element(screen.getByRole('group', { name: 'Instruments' }).getByText('GHOST')).toBeVisible();
  });

  it('steps a whole week at a time', async () => {
    const screen = await openWeek('/week?site=GS&night=2025-11-14');

    await screen.getByRole('button', { name: 'Next week' }).click();
    await expect.element(screen.getByText('Nights beginning 2025-11-20 to 2025-11-26')).toBeVisible();

    await screen.getByRole('button', { name: 'Previous week' }).click();
    await expect.element(screen.getByText('Nights beginning 2025-11-13 to 2025-11-19')).toBeVisible();
  });

  it('links the semester it belongs to - the reverse of the calendar click-through', async () => {
    const screen = await openWeek('/week?site=GS&night=2025-11-14');

    await screen.getByRole('link', { name: 'Gemini South Semester 2025B', exact: false }).click();

    await expect.element(screen.getByTestId('semester-timeline')).toBeVisible();
  });

  it('jumps back to the week that starts tonight from a deep link', async () => {
    const screen = await openWeek('/week?site=GS&night=2025-11-14');

    await screen.getByRole('button', { name: 'Tonight' }).click();

    // Derived with the page's own functions, not a fixture date: Tonight is
    // the one control that must follow the wall clock.
    const tonight = observingNightOf('GS', Date.now());
    await expect
      .element(screen.getByText(`Nights beginning ${addDays(tonight, -1)} to ${addDays(tonight, 5)}`))
      .toBeVisible();
    await expect.element(screen.getByRole('button', { name: 'Tonight' })).toBeDisabled();
  });

  it('picks the week by the evening it begins, in the same vocabulary as the heading', async () => {
    const screen = await openWeek('/week?site=GS&night=2025-11-14');

    // The input shows the first evening; choosing one asks for the week whose
    // first night begins that evening.
    const input = screen.getByLabelText('First evening');
    await expect.element(input).toHaveValue('2025-11-13');

    await input.fill('2025-11-20');

    await expect.element(screen.getByText('Nights beginning 2025-11-20 to 2025-11-26')).toBeVisible();
  });

  it('briefs each night: dark hours, moon, and the week’s totals', async () => {
    const screen = await openWeek('/week?site=GS&night=2025-11-14');

    // One facts card per night, phrased in the calendar's honesty rules.
    await expect.poll(() => document.querySelectorAll('[data-testid="week-night-facts"]').length).toBe(7);
    await expect.element(screen.getByText('h dark', { exact: false }).first()).toBeVisible();
    await expect.element(screen.getByText('% moon', { exact: false }).first()).toBeVisible();
    // The header's one-glance numbers.
    await expect.element(screen.getByText('h of astronomical dark', { exact: false })).toBeVisible();
  });

  it('lists what changes this week, with the clock time of a mid-night change', async () => {
    // The synthetic R400 grating fails at midnight site time inside the night
    // labelled 2025-11-20 - a boundary strictly inside this window.
    const screen = await openWeek('/week?site=GS&night=2025-11-20');

    const changes = screen.getByTestId('week-changes');
    await expect.element(changes.getByText('R400 to Summit lab')).toBeVisible();
    await expect.element(changes.getByText('Failed; removed for repair')).toBeVisible();
    await expect.element(changes.getByText('00:00', { exact: false })).toBeVisible();
  });

  it('phrases the change instants in UT when the masthead clock says so', async () => {
    // The same R400 failure: 00:00 at the site is 03:00 UT in November (UTC-3).
    const screen = await openWeek('/week?site=GS&night=2025-11-20&clock=utc');

    const changes = screen.getByTestId('week-changes');
    await expect.element(changes.getByText('03:00', { exact: false })).toBeVisible();
  });

  it('says so plainly when nothing changes all week', async () => {
    // Mid-September 2025B at GS: every run carries straight through.
    const screen = await openWeek('/week?site=GS&night=2025-09-08');

    await expect.element(screen.getByText('Nothing changes this week', { exact: false })).toBeVisible();
    await expect.element(screen.getByTestId('week-changes')).not.toBeInTheDocument();
  });

  it('keys the chrome as well as the data: the sky it paints and the weekends it shades', async () => {
    const screen = await openWeek('/week?site=GS&night=2025-11-14');
    const legend = screen.getByLabelText('Legend');

    await expect.element(legend.getByRole('group', { name: 'Sky' }).getByText('Daylight')).toBeVisible();
    await expect.element(legend.getByRole('group', { name: 'Calendar' }).getByText('Weekend')).toBeVisible();
  });

  it('keys the colours to the instruments the week actually holds', async () => {
    const screen = await openWeek('/week?site=GS&night=2025-11-14');
    const legend = screen.getByLabelText('Legend');

    await expect.element(legend.getByText('GHOST')).toBeVisible();
    await expect.element(legend.getByText('GMOS')).toBeVisible();
  });

  it('opens the night view from a facts card', async () => {
    const screen = await openWeek('/week?site=GS&night=2025-11-14');

    // The card headed "Fri 13" is the night labelled the 14th - the whole card
    // is the link, like a calendar square.
    await screen.getByRole('button', { name: 'Open night beginning 2025-11-13' }).click();

    await expect.element(screen.getByText('Night of 2025-11-14')).toBeVisible();
  });

  it('opens the night view from the chart', async () => {
    const screen = await openWeek('/week?site=GS&night=2025-11-14');
    await expect.element(screen.getByTestId('week-timeline')).toBeVisible();
    await expect.poll(() => document.querySelector('[data-testid="week-timeline"] .highcharts-point')).not.toBeNull();

    // Clicking a bar opens the night under the cursor - which night that is
    // depends on where the bar's centre lands, so the assertion is the jump
    // itself; `nightAt` pins the instant-to-night mapping.
    const bar = document.querySelector('[data-testid="week-timeline"] .highcharts-point');
    await page.elementLocator(bar!).click();

    await expect.element(screen.getByTestId('night-timeline')).toBeVisible();
  });

  it('keeps the tag off a published week', async () => {
    const screen = await openWeek('/week?site=GS&night=2025-11-14');

    await expect.element(screen.getByTestId('week-timeline')).toBeVisible();
    await expect.element(screen.getByTestId('synthetic-data-tag')).not.toBeInTheDocument();
  });

  it('says so when no published schedule reaches the week', async () => {
    const screen = await openWeek('/week?site=GS&night=2030-01-01');

    await expect.element(screen.getByText('No published schedule covers these nights', { exact: false })).toBeVisible();
    await expect.element(screen.getByTestId('week-timeline')).not.toBeInTheDocument();
  });
});
