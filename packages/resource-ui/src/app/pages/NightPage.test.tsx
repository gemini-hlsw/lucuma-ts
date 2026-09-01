// The one stylesheet a test loads: a Highcharts overlay that catches the pointer swallows the hover.
import '@/styles/chartOverlays.css';

import { ApolloLink } from '@apollo/client';
import { Observable } from '@apollo/client/utilities';
import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';

import Layout from '@/components/layout/Layout';
import { observingNightInterval, observingNightOf } from '@/domain/siteTime';
import { NIGHT_SCHEDULE_QUERY } from '@/gql/resource';
import { createMockApollo } from '@/test/mockClient';
import { renderApp } from '@/test/renderApp';

import NightPage from './NightPage';
import SemesterPage from './SemesterPage';

const openNight = async (route: string) =>
  renderApp({ element: <NightPage />, route, extraRoutes: [{ path: '/semester', element: <SemesterPage /> }] });

/** The failure is at the transport, the deterministic way to reach an undefined dataAvailable. */
const nightQueryCannotBeReached = () =>
  createMockApollo(
    new ApolloLink((operation, forward) =>
      operation.operationName === 'NightSchedule'
        ? new Observable<ApolloLink.Result>((observer) => {
            observer.error(new Error('the Resource service did not answer'));
          })
        : forward(operation),
    ),
  );

describe('NightPage - the telescope-state rows the workbook records', () => {
  it('draws the workbook shutdown as a band and a closed Telescope row, with no mode row', async () => {
    // GS's August 2024 shutdown: no Mode row, since the telescope is operated in no mode during one.
    const screen = await openNight('/night?site=GS&night=2024-08-05');

    await expect.element(screen.getByText('Shutdown').first()).toBeVisible();
    await expect.element(screen.getByText('Telescope').first()).toBeVisible();
    await expect.element(screen.getByText('Standard ToOs').first()).toBeVisible();
    await expect.element(screen.getByText('Queue')).not.toBeInTheDocument();
  });

  it('heads a visitor night with the Telescope and Mode rows, their values keyed in sections', async () => {
    // The legend keys the recorded values in the words the blocks print.
    const screen = await openNight('/night?site=GN&night=2026-08-27');

    await expect.element(screen.getByText('Priority visitor').first()).toBeVisible();
    // One legend section per state row, so a grey repeated across rows is keyed under its own row.
    await expect.element(screen.getByRole('group', { name: 'Telescope' }).getByText('Open')).toBeVisible();
    await expect.element(screen.getByRole('group', { name: 'Mode' }).getByText('Priority visitor')).toBeVisible();
    await expect.element(screen.getByRole('group', { name: 'ToO' }).getByText('Standard ToOs')).toBeVisible();
  });

  it('reads an unknown clock parameter as the site clock, never as UT or blank', async () => {
    const screen = await openNight('/night?site=GS&night=2025-11-14&clock=zulu');

    await expect.element(screen.getByText('14:00 to 14:00 site time', { exact: false })).toBeVisible();
  });
});

describe(NightPage, () => {
  it('draws the night, one row per published port', async () => {
    const screen = await openNight('/night?site=GS&night=2025-11-14');

    await expect.element(screen.getByText('Night of 2025-11-14')).toBeVisible();
    await expect.element(screen.getByTestId('night-timeline')).toBeVisible();
    await expect.element(screen.getByText('GHOST').first()).toBeVisible();
  });

  it('states the night in the site clock, with its moon', async () => {
    const screen = await openNight('/night?site=GS&night=2025-11-14');

    // 14:00 to 14:00 at Cerro Pachon, whatever zone the reader is in.
    await expect.element(screen.getByText('14:00 to 14:00 site time', { exact: false })).toBeVisible();
    await expect.element(screen.getByText('illuminated', { exact: false })).toBeVisible();
  });

  it('says no schedule reaches a night outside every published semester', async () => {
    const screen = await openNight('/night?site=GS&night=2030-01-01');

    await expect.element(screen.getByText('No published schedule covers this night', { exact: false })).toBeVisible();
    await expect.element(screen.getByTestId('night-timeline')).not.toBeInTheDocument();
  });

  it('says what is covered instead of dead-ending, and offers the nearest covered night', async () => {
    const screen = await openNight('/night?site=GS&night=2030-01-01');

    // The workbook's four GS semesters abut into one unbroken range.
    await expect
      .element(screen.getByText('Published nights at GS run 2024-08-02 to 2026-08-01', { exact: false }))
      .toBeVisible();

    await screen.getByRole('button', { name: 'Open the nearest covered night, 2026-08-01' }).click();
    await expect.element(screen.getByText('Night of 2026-08-01')).toBeVisible();
    await expect.element(screen.getByTestId('night-timeline')).toBeVisible();
  });

  // A night the workbook never filled in is unreachable from its data; pinned at the API instead.

  it('draws no timeline when the night query fails, rather than an empty one beside the alert', async () => {
    // The page knows 2025B holds this night while knowing nothing about the night itself.
    const screen = await renderApp({
      element: <NightPage />,
      route: '/night?site=GS&night=2025-11-14',
      mock: nightQueryCannotBeReached(),
    });

    // Settle on the failure first, so the absences below are read after the query resolved.
    await expect.element(screen.getByRole('alert')).toHaveTextContent('the Resource service did not answer');
    await expect.element(screen.getByText('Gemini South Semester 2025B', { exact: false })).toBeVisible();

    await expect.element(screen.getByTestId('night-timeline')).not.toBeInTheDocument();
    // A query that never arrived is not a recorded absence, and must not be reported as one.
    await expect
      .element(screen.getByText('Nothing is recorded for this night', { exact: false }))
      .not.toBeInTheDocument();
  });

  it('links the semester it belongs to - the reverse of the calendar click-through', async () => {
    const screen = await openNight('/night?site=GS&night=2025-11-14');

    await screen.getByRole('link', { name: 'Gemini South Semester 2025B', exact: false }).click();

    await expect.element(screen.getByTestId('semester-timeline')).toBeVisible();
  });

  it('jumps back to the night in progress from a deep link', async () => {
    const screen = await openNight('/night?site=GS&night=2025-11-14');
    await expect.element(screen.getByText('Night of 2025-11-14')).toBeVisible();

    await screen.getByRole('button', { name: 'Tonight' }).click();

    // Derived with the page's own function: Tonight is the one control that must follow the wall clock.
    const tonight = observingNightOf('GS', Date.now());
    await expect.element(screen.getByText(`Night of ${tonight}`)).toBeVisible();
    await expect.element(screen.getByRole('button', { name: 'Tonight' })).toBeDisabled();
  });

  it('steps to the next night and back', async () => {
    const screen = await openNight('/night?site=GS&night=2025-11-14');
    await expect.element(screen.getByText('Night of 2025-11-14')).toBeVisible();

    await screen.getByRole('button', { name: 'Next night' }).click();
    await expect.element(screen.getByText('Night of 2025-11-15')).toBeVisible();

    await screen.getByRole('button', { name: 'Previous night' }).click();
    await expect.element(screen.getByText('Night of 2025-11-14')).toBeVisible();
  });

  it('picks a night from the date input, without stepping to it', async () => {
    const screen = await openNight('/night?site=GS&night=2025-11-14');
    await expect.element(screen.getByText('Night of 2025-11-14')).toBeVisible();

    await screen.getByLabelText('Observing night').fill('2025-12-15');

    await expect.element(screen.getByText('Night of 2025-12-15')).toBeVisible();
    await expect.element(screen.getByTestId('night-timeline')).toBeVisible();
  });

  it('keeps a revisited night intact - one window must not poison another', async () => {
    // Blocks carry no id and every range query asks clip: false, so one night cannot overwrite another.
    const screen = await openNight('/night?site=GS&night=2025-11-14');
    const points = () => document.querySelectorAll('[data-testid="night-timeline"] .highcharts-point').length;
    await expect.poll(points).toBeGreaterThan(0);

    await screen.getByRole('button', { name: 'Next night' }).click();
    await expect.element(screen.getByText('Night of 2025-11-15')).toBeVisible();
    await screen.getByRole('button', { name: 'Previous night' }).click();
    await expect.element(screen.getByText('Night of 2025-11-14')).toBeVisible();

    await expect.poll(points).toBeGreaterThan(0);
  });

  it('switches site and redraws against that site’s schedule', async () => {
    const screen = await openNight('/night?site=GN&night=2026-11-14');

    await expect.element(screen.getByText('Gemini North Semester 2026B', { exact: false })).toBeVisible();
  });

  it('moves the chart clock to UT with the masthead toggle', async () => {
    // The toggle keeps the axis window, so the labels prove the in-place update took the new zone.
    const screen = await renderApp({
      element: <Layout />,
      route: '/night?site=GS&night=2025-11-14',
      path: '/',
      childRoutes: [{ path: 'night', element: <NightPage /> }],
    });
    const labels = () =>
      [...document.querySelectorAll('[data-testid="night-timeline"] .highcharts-xaxis-labels text')]
        .map((tick) => tick.textContent ?? '')
        .join('|');
    await expect.poll(() => labels().length).toBeGreaterThan(0);
    const siteLabels = labels();

    await screen.getByRole('button', { name: 'Coordinated Universal Time' }).click();

    // Non-empty first: a blanked chart must not slip through as merely "different".
    await expect.element(screen.getByText('17:00 to 17:00 UTC', { exact: false })).toBeVisible();
    await expect.poll(() => labels().length).toBeGreaterThan(0);
    await expect.poll(labels).not.toBe(siteLabels);
  });

  it('heads the chart with the subsystem rows - the sensors and the laser', async () => {
    const screen = await openNight('/night?site=GS&night=2025-11-14');

    await expect.element(screen.getByText('PWFS1').first()).toBeVisible();
    await expect.element(screen.getByText('PWFS2').first()).toBeVisible();
    // GS has no laser: printed in words rather than shouted in the bright neutral on every GS night.
    await expect.element(screen.getByText('LGS').first()).toBeVisible();
    await expect.element(screen.getByText('Not available').first()).toBeVisible();
  });

  it('reads the laser per site: available at Gemini North, not at Gemini South', async () => {
    // GN prints "Yes" and GS "No" on every night of this export, so the two sites must not read alike.
    const north = await openNight('/night?site=GN&night=2026-08-27');
    const chart = north.getByTestId('night-timeline');
    await expect.element(chart).toBeVisible();
    await expect.element(chart.getByText('Available').first()).toBeVisible();
    await expect.element(chart.getByText('Not available')).not.toBeInTheDocument();
  });

  it('keeps an off-port run off the chart - the schedule is the ports picture', async () => {
    // The API serves the port-less visitor run, but the chart draws the five ports and nothing else.
    const screen = await openNight('/night?site=GN&night=2026-09-26');

    const chart = screen.getByTestId('night-timeline');
    await expect.element(chart).toBeVisible();
    await expect.element(chart.getByText('`Alopeke')).not.toBeInTheDocument();
  });

  it('keys the sky it paints - the washes are the largest thing on the chart', async () => {
    const screen = await openNight('/night?site=GS&night=2025-11-14');
    const sky = screen.getByLabelText('Legend').getByRole('group', { name: 'Sky' });

    await expect.element(sky.getByText('Daylight')).toBeVisible();
    await expect.element(sky.getByText('Twilight')).toBeVisible();
  });

  it('keeps a bar hoverable beneath the sun wash, so the tooltip still comes', async () => {
    const screen = await openNight('/night?site=GS&night=2025-11-14');
    await expect.element(screen.getByTestId('night-timeline')).toBeVisible();
    await expect.poll(() => document.querySelector('[data-testid="night-timeline"] .highcharts-point')).not.toBeNull();

    // The daylight wash is drawn over the bars, so it must be pointer-transparent or it eats the tooltip.
    const bar = document.querySelector('[data-testid="night-timeline"] .highcharts-point');
    await page.elementLocator(bar!).hover({ position: { x: 6, y: 8 } });

    // GHOST runs the whole semester, so this night's tooltip reads "all night".
    await expect.element(page.getByText('all night')).toBeVisible();
  });
});

describe('the night window the client computes', () => {
  it('is the one the API resolves, so the blocks asked for are the night drawn', async () => {
    // siteTime.ts mirrors mock-server/time.ts; a drift would draw one night's records on another's axis.
    const { client } = createMockApollo();
    const ours = observingNightInterval('GS', '2026-11-14');

    const result = await client.query({
      query: NIGHT_SCHEDULE_QUERY,
      variables: {
        site: 'GS',
        night: '2026-11-14',
        interval: { start: new Date(ours.start).toISOString(), end: new Date(ours.end).toISOString() },
      },
    });

    const theirs = result.data?.telescopeNight.interval;
    expect(theirs).toBeDefined();
    expect(Date.parse(theirs?.start ?? '')).toBe(ours.start);
    expect(Date.parse(theirs?.end ?? '')).toBe(ours.end);
  });

  it('agrees across a DST change at Gemini South, where a night is 23 hours', async () => {
    const { client } = createMockApollo();
    // Chile springs forward inside the night labelled 2026-09-06.
    const ours = observingNightInterval('GS', '2026-09-06');
    expect(ours.end - ours.start).toBe(23 * 3_600_000);

    const result = await client.query({
      query: NIGHT_SCHEDULE_QUERY,
      variables: {
        site: 'GS',
        night: '2026-09-06',
        interval: { start: new Date(ours.start).toISOString(), end: new Date(ours.end).toISOString() },
      },
    });

    const theirs = result.data?.telescopeNight.interval;
    expect(theirs).toBeDefined();
    expect(Date.parse(theirs?.start ?? '')).toBe(ours.start);
    expect(Date.parse(theirs?.end ?? '')).toBe(ours.end);
  });
});
