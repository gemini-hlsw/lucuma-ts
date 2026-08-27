// The one stylesheet a test loads, and only because the rule in it is
// behaviour rather than appearance: a Highcharts overlay that catches the
// pointer swallows the hover under it. The rest of `src/styles/` is
// appearance and these tests run without it (see `vite.config.ts`).
import '@/styles/chartOverlays.css';

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

describe('NightPage - the telescope-state rows the workbook records', () => {
  it('draws the workbook shutdown as a band and a closed Telescope row, with no mode row', async () => {
    // GS's August 2024 shutdown: the closure band carries the reason, the
    // Telescope row states the recorded "Closed", and the Mode row is absent -
    // the telescope is not being operated in any mode during a shutdown. The
    // assumed Standard ToO support is a semester-wide default and spans it.
    const screen = await openNight('/night?site=GS&night=2024-08-05');

    await expect.element(screen.getByText('Shutdown').first()).toBeVisible();
    await expect.element(screen.getByText('Telescope').first()).toBeVisible();
    await expect.element(screen.getByText('Standard ToOs').first()).toBeVisible();
    await expect.element(screen.getByText('Queue')).not.toBeInTheDocument();
  });

  it('heads a visitor night with the Telescope and Mode rows, their values keyed in sections', async () => {
    // GN, inside the August 2026 MAROON-X visitor run. The legend's Telescope
    // section keys the recorded values in the words the blocks print, and the
    // ToO section carries the assumed Standard default.
    const screen = await openNight('/night?site=GN&night=2026-08-27');

    await expect.element(screen.getByText('Priority visitor').first()).toBeVisible();
    // One legend section per state row, so a grey repeated across rows is
    // keyed under the row it belongs to.
    await expect.element(screen.getByRole('group', { name: 'Telescope' }).getByText('Open')).toBeVisible();
    await expect.element(screen.getByRole('group', { name: 'Mode' }).getByText('Priority visitor')).toBeVisible();
    await expect.element(screen.getByRole('group', { name: 'ToO' }).getByText('Standard ToOs')).toBeVisible();
  });

  it('reads an unknown clock parameter as the site clock, never as UT or blank', async () => {
    // A mistyped `clock` value degrades to the reading the site works in
    // (useSelection): only the explicit 'utc' switches the display.
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

  // The other absence - a night inside a semester that the workbook never
  // filled in - is not reachable from its data: every night carries at least
  // the ToOs column. `dataAvailable: false` is pinned at the API instead, in
  // mock-server/resolvers.test.ts.

  it('links the semester it belongs to - the reverse of the calendar click-through', async () => {
    const screen = await openNight('/night?site=GS&night=2025-11-14');

    await screen.getByRole('link', { name: 'Gemini South Semester 2025B', exact: false }).click();

    await expect.element(screen.getByTestId('semester-timeline')).toBeVisible();
  });

  it('jumps back to the night in progress from a deep link', async () => {
    const screen = await openNight('/night?site=GS&night=2025-11-14');
    await expect.element(screen.getByText('Night of 2025-11-14')).toBeVisible();

    await screen.getByRole('button', { name: 'Tonight' }).click();

    // Derived with the page's own function, not a fixture date: Tonight is the
    // one control that must follow the wall clock.
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
    // Every availability query clips its blocks to the night asked for, under
    // stable block ids. Normalized by id, night B's response overwrote night
    // A's intervals, so revisiting A from the cache drew an empty chart
    // (found via Tonight after stepping, 2026-08-10). Pinned here through
    // prev/next, which is the same cache-hit path.
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
    // The dual of the semester chart's stability test: there nothing may
    // move when the clock does; here everything must. The toggle keeps the
    // axis window, so no remount - the axis labels prove the in-place
    // Highcharts update actually took the new zone rather than silently
    // keeping the old one.
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

    // The header is the already-pinned reading; the chart must follow it.
    // Non-empty first: a blanked chart (the Highcharts empty-series failure)
    // must not slip through as merely "different".
    await expect.element(screen.getByText('17:00 to 17:00 UTC', { exact: false })).toBeVisible();
    await expect.poll(() => labels().length).toBeGreaterThan(0);
    await expect.poll(labels).not.toBe(siteLabels);
  });

  it('heads the chart with the subsystem rows - the sensors and the laser', async () => {
    const screen = await openNight('/night?site=GS&night=2025-11-14');

    await expect.element(screen.getByText('PWFS1').first()).toBeVisible();
    await expect.element(screen.getByText('PWFS2').first()).toBeVisible();
    // GS has no laser: the LGS row states Not available - a recorded fact,
    // printed in words rather than shouted in the bright neutral, which would
    // otherwise fire on every GS night forever.
    await expect.element(screen.getByText('LGS').first()).toBeVisible();
    await expect.element(screen.getByText('Not available').first()).toBeVisible();
  });

  it('reads the laser per site: available at Gemini North, not at Gemini South', async () => {
    // The workbook's LGS column, in the subsystem's own words. GN prints
    // "Yes" and GS "No" on every night of this export, so the two sites must
    // not read alike.
    const north = await openNight('/night?site=GN&night=2026-08-27');
    const chart = north.getByTestId('night-timeline');
    await expect.element(chart).toBeVisible();
    await expect.element(chart.getByText('Available').first()).toBeVisible();
    await expect.element(chart.getByText('Not available')).not.toBeInTheDocument();
  });

  it('keeps an off-port run off the chart - the schedule is the ports picture', async () => {
    // GN, inside the late-September 2026 `Alopeke visitor run: the API serves
    // it, and resolvers.test.ts pins that, but the chart draws the five ports
    // and nothing else. The instrument browser is where it shows.
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

    // Near the bar's left edge the cursor is deep in the daylight wash, which
    // is deliberately drawn over the bars. Hover resolves to the element under
    // the cursor, so an overlay that catches the pointer swallows the tooltip -
    // the wash must be pointer-transparent (`styles/chartOverlays.css`,
    // imported above).
    const bar = document.querySelector('[data-testid="night-timeline"] .highcharts-point');
    await page.elementLocator(bar!).hover({ position: { x: 6, y: 8 } });

    // GHOST runs the whole semester, so this night's tooltip reads "all night".
    await expect.element(page.getByText('all night')).toBeVisible();
  });
});

describe('the night window the client computes', () => {
  it('is the one the API resolves, so the blocks asked for are the night drawn', async () => {
    // siteTime.ts deliberately mirrors mock-server/time.ts, and the page uses
    // its own result to ask for blocks while showing the API's dataAvailable
    // for the same night. If the two ever drift, the view would draw one night's
    // records against another night's axis.
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
