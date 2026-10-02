// The one stylesheet a test loads: a Highcharts overlay that catches the pointer swallows the hover.
import '@/styles/chartOverlays.css';

import type { MockLink } from '@apollo/client/testing';
import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';

import Layout from '@/components/layout/Layout';
import { observingNightOf } from '@/domain/siteTime';
import {
  instrumentAvailabilityBlock,
  overNights,
  telescopeAvailabilityBlock,
  telescopeModeBlock,
  telescopeSubsystemAvailabilityBlock,
  tooSupportBlock,
} from '@/test/fixtures/blocks';
import { nightSchedule } from '@/test/fixtures/night';
import { publishedSemester, publishedSemesters } from '@/test/fixtures/semester';
import { chooseClock } from '@/test/helpers';
import { Probe, PROBE_URL_TESTID } from '@/test/probe';
import { renderApp } from '@/test/renderApp';

import NightPage from './NightPage';

const GS_2024B = publishedSemester({ site: 'GS', semester: '2024B' });
const GS_2025A = publishedSemester({ site: 'GS', semester: '2025A' });
const GS_2025B = publishedSemester({ site: 'GS', semester: '2025B' });
const GS_2026A = publishedSemester({ site: 'GS', semester: '2026A' });
const GS_2026B = publishedSemester({ site: 'GS', semester: '2026B' });
const GN_2026B = publishedSemester({ site: 'GN', semester: '2026B' });

const GHOST = instrumentAvailabilityBlock({
  instrument: 'GHOST',
  port: 1,
  interval: overNights('GS', '2025-08-02', '2026-02-01'),
});

/** Stands in for the semester view: the subject is the link, not what the semester draws. */
const SEMESTER_ROUTE = { path: '/semester', element: <Probe use={() => null} /> };

const shownUrl = () => document.querySelector(`[data-testid="${PROBE_URL_TESTID}"]`)?.textContent ?? '';

const openNight = (route: string, ...mocks: MockLink.MockedResponse[]) =>
  renderApp({ element: <NightPage />, route, extraRoutes: [SEMESTER_ROUTE], mocks });

/** GS on 2025-11-14 with GHOST on its port: the ordinary night most tests open. */
const openOrdinaryNight = (...more: MockLink.MockedResponse[]) =>
  openNight(
    '/night?site=GS&night=2025-11-14',
    publishedSemesters(GS_2025B),
    nightSchedule({ site: 'GS', night: '2025-11-14' }, { instrumentAvailability: [GHOST] }),
    ...more,
  );

const chartBars = () =>
  [...document.querySelectorAll('[data-testid="night-timeline"] path.highcharts-point')]
    .map((point) => `${point.getAttribute('d') ?? ''}#${point.getAttribute('fill') ?? ''}`)
    .join('|');

describe(NightPage, () => {
  describe('the telescope-state rows', () => {
    it('draws a shutdown as a closed Telescope row, and an unrecorded mode as no Mode row at all', async () => {
      const shutdown = overNights('GS', '2024-08-02', '2024-08-16');
      const screen = await openNight(
        '/night?site=GS&night=2024-08-05',
        publishedSemesters(GS_2024B),
        nightSchedule(
          { site: 'GS', night: '2024-08-05' },
          {
            telescopeAvailability: [telescopeAvailabilityBlock({ interval: shutdown, reason: 'Shutdown' })],
            tooSupport: [tooSupportBlock({ interval: shutdown })],
          },
        ),
      );

      const legend = screen.getByLabelText('Legend');
      await expect.element(legend.getByRole('group', { name: 'Telescope' }).getByText('Closed')).toBeVisible();
      await expect.element(legend.getByRole('group', { name: 'ToO' }).getByText('Standard ToOs')).toBeVisible();
      // A gap is not recorded, so the mode is not drawn as anything - not Queue, not Shutdown.
      await expect.element(legend.getByRole('group', { name: 'Mode' })).not.toBeInTheDocument();
    });

    it('heads a visitor night with the Telescope and Mode rows, their values keyed in sections', async () => {
      const night = overNights('GN', '2026-08-27', '2026-08-27');
      const screen = await openNight(
        '/night?site=GN&night=2026-08-27',
        publishedSemesters(GN_2026B),
        nightSchedule(
          { site: 'GN', night: '2026-08-27' },
          {
            telescopeAvailability: [telescopeAvailabilityBlock({ interval: night, availability: 'OPEN' })],
            telescopeMode: [telescopeModeBlock({ interval: night, mode: 'PRIORITY_VISITOR' })],
            tooSupport: [tooSupportBlock({ interval: night })],
          },
        ),
      );

      await expect.element(screen.getByText('Priority visitor').first()).toBeVisible();
      // One legend section per state row, so a grey repeated across rows is keyed under its own row.
      await expect.element(screen.getByRole('group', { name: 'Telescope' }).getByText('Open')).toBeVisible();
      await expect.element(screen.getByRole('group', { name: 'Mode' }).getByText('Priority visitor')).toBeVisible();
      await expect.element(screen.getByRole('group', { name: 'ToO' }).getByText('Standard ToOs')).toBeVisible();
    });

    it('leaves a stretch the Telescope row does not record empty, never reading it as closed', async () => {
      // Open for the first night only: the second night is a gap in the telescope's record.
      const screen = await openNight(
        '/night?site=GS&night=2025-11-15',
        publishedSemesters(GS_2025B),
        nightSchedule(
          { site: 'GS', night: '2025-11-15' },
          {
            telescopeAvailability: [
              telescopeAvailabilityBlock({
                interval: overNights('GS', '2025-11-14', '2025-11-14'),
                availability: 'OPEN',
              }),
            ],
            instrumentAvailability: [GHOST],
          },
        ),
      );

      await expect.element(screen.getByTestId('night-timeline')).toBeVisible();
      await expect.poll(() => chartBars().length).toBeGreaterThan(0);
      await expect.element(screen.getByText('Closed')).not.toBeInTheDocument();
    });
  });

  describe('the night the backend holds nothing for', () => {
    it('says nothing is recorded, rather than drawing an empty chart', async () => {
      const screen = await openNight(
        '/night?site=GS&night=2025-11-14',
        publishedSemesters(GS_2025B),
        nightSchedule({ site: 'GS', night: '2025-11-14' }, { dataAvailable: false }),
      );

      await expect.element(screen.getByText('Nothing is recorded for this night', { exact: false })).toBeVisible();
      await expect.element(screen.getByTestId('night-timeline')).not.toBeInTheDocument();
    });
  });

  it('reads an unknown stored clock as the site clock, never as UT or blank', async () => {
    // Storage is shared with whatever wrote it last, including an older build of this app.
    localStorage.setItem('resource.clock', 'zulu');
    const screen = await openOrdinaryNight();

    await expect.element(screen.getByText('14:00 to 14:00 site time', { exact: false })).toBeVisible();
  });

  it('draws the night, one row per published port', async () => {
    const screen = await openOrdinaryNight();

    await expect.element(screen.getByText('Night of 2025-11-14')).toBeVisible();
    await expect.element(screen.getByTestId('night-timeline')).toBeVisible();
    await expect.element(screen.getByText('GHOST').first()).toBeVisible();
  });

  it('states the night in the site clock, with its moon', async () => {
    const screen = await openOrdinaryNight();

    // 14:00 to 14:00 at Cerro Pachon, whatever zone the reader is in.
    await expect.element(screen.getByText('14:00 to 14:00 site time', { exact: false })).toBeVisible();
    await expect.element(screen.getByText('illuminated', { exact: false })).toBeVisible();
  });

  it('says no schedule reaches a night outside every published semester', async () => {
    const screen = await openNight(
      '/night?site=GS&night=2030-01-01',
      publishedSemesters(GS_2025B),
      nightSchedule({ site: 'GS', night: '2030-01-01' }, { dataAvailable: false }),
    );

    await expect.element(screen.getByText('No published schedule covers this night', { exact: false })).toBeVisible();
    await expect.element(screen.getByTestId('night-timeline')).not.toBeInTheDocument();
    // One answer, not two: the not-recorded panel says something else entirely about the same night.
    await expect
      .element(screen.getByText('Nothing is recorded for this night', { exact: false }))
      .not.toBeInTheDocument();
  });

  it('says what is covered instead of dead-ending, and offers the nearest covered night', async () => {
    const screen = await openNight(
      '/night?site=GS&night=2030-01-01',
      publishedSemesters(GS_2024B, GS_2025A, GS_2025B, GS_2026A),
      nightSchedule({ site: 'GS', night: '2030-01-01' }, { dataAvailable: false }),
      nightSchedule({ site: 'GS', night: '2026-08-01' }),
    );

    // Four abutting semesters read as one unbroken range.
    await expect
      .element(screen.getByText('Published nights at GS run 2024-08-02 to 2026-08-01', { exact: false }))
      .toBeVisible();

    await screen.getByRole('button', { name: 'Open the nearest covered night, 2026-08-01' }).click();
    await expect.element(screen.getByText('Night of 2026-08-01')).toBeVisible();
    await expect.element(screen.getByTestId('night-timeline')).toBeVisible();
  });

  it('draws no timeline when the night query fails, rather than an empty one beside the alert', async () => {
    // The page knows 2025B holds this night while knowing nothing about the night itself.
    const screen = await openNight('/night?site=GS&night=2025-11-14', publishedSemesters(GS_2025B), {
      request: nightSchedule({ site: 'GS', night: '2025-11-14' }).request,
      error: new Error('the Resource service did not answer'),
    });

    // Settle on the failure first, so the absences below are read after the query resolved.
    await expect.element(screen.getByRole('alert')).toMatchTextContent('the Resource service did not answer');
    await expect.element(screen.getByText('Gemini South Semester 2025B', { exact: false })).toBeVisible();

    await expect.element(screen.getByTestId('night-timeline')).not.toBeInTheDocument();
    // A query that never arrived is not a recorded absence, and must not be reported as one.
    await expect
      .element(screen.getByText('Nothing is recorded for this night', { exact: false }))
      .not.toBeInTheDocument();
  });

  it('links the semester it belongs to - the reverse of the calendar click-through', async () => {
    const screen = await openOrdinaryNight();

    await screen.getByRole('link', { name: 'Gemini South Semester 2025B', exact: false }).click();

    await expect.poll(shownUrl).toBe('/semester?site=GS&night=2025-11-14&semester=2025B');
  });

  it('jumps back to the night in progress from a deep link', async () => {
    // Derived with the page's own function: Tonight is the one control that must follow the wall clock.
    const tonight = observingNightOf('GS', Date.now());
    const screen = await openOrdinaryNight(nightSchedule({ site: 'GS', night: tonight }));
    await expect.element(screen.getByText('Night of 2025-11-14')).toBeVisible();

    await screen.getByRole('button', { name: 'Tonight' }).click();

    await expect.element(screen.getByText(`Night of ${tonight}`)).toBeVisible();
    await expect.element(screen.getByRole('button', { name: 'Tonight' })).toBeDisabled();
  });

  it('steps to the next night and back', async () => {
    const screen = await openOrdinaryNight(
      nightSchedule({ site: 'GS', night: '2025-11-15' }, { instrumentAvailability: [GHOST] }),
    );
    await expect.element(screen.getByText('Night of 2025-11-14')).toBeVisible();
    await expect.element(screen.getByText('GHOST').first()).toBeVisible();

    await screen.getByRole('button', { name: 'Next night' }).click();
    await expect.element(screen.getByText('Night of 2025-11-15')).toBeVisible();
    await expect.element(screen.getByText('GHOST').first()).toBeVisible();

    await screen.getByRole('button', { name: 'Previous night' }).click();
    await expect.element(screen.getByText('Night of 2025-11-14')).toBeVisible();
    await expect.element(screen.getByText('GHOST').first()).toBeVisible();
  });

  it('picks a night from the date input, without stepping to it', async () => {
    const screen = await openOrdinaryNight(nightSchedule({ site: 'GS', night: '2025-12-15' }));
    await expect.element(screen.getByText('Night of 2025-11-14')).toBeVisible();

    await screen.getByLabelText('Observing night').fill('2025-12-15');

    await expect.element(screen.getByText('Night of 2025-12-15')).toBeVisible();
    await expect.element(screen.getByTestId('night-timeline')).toBeVisible();
  });

  it('steps a night away and back, redrawing the cached night in place', async () => {
    // A closed night bordering an open one, so the two windows draw different bars.
    const screen = await openNight(
      '/night?site=GS&night=2024-08-16',
      publishedSemesters(GS_2024B),
      nightSchedule(
        { site: 'GS', night: '2024-08-16' },
        {
          telescopeAvailability: [
            telescopeAvailabilityBlock({ interval: overNights('GS', '2024-08-16', '2024-08-16') }),
          ],
        },
      ),
      nightSchedule(
        { site: 'GS', night: '2024-08-17' },
        {
          telescopeAvailability: [
            telescopeAvailabilityBlock({
              interval: overNights('GS', '2024-08-17', '2024-08-17'),
              availability: 'OPEN',
            }),
          ],
        },
      ),
    );
    await expect.poll(() => chartBars().length).toBeGreaterThan(0);
    const homeBars = chartBars();

    await screen.getByRole('button', { name: 'Next night' }).click();
    await expect.element(screen.getByText('Night of 2024-08-17')).toBeVisible();
    // Changed before non-empty: a blank chart also passes "changed".
    await expect.poll(chartBars).not.toBe(homeBars);
    await expect.poll(() => chartBars().length).toBeGreaterThan(0);

    await screen.getByRole('button', { name: 'Previous night' }).click();
    await expect.element(screen.getByText('Night of 2024-08-16')).toBeVisible();
    await expect.poll(chartBars).toBe(homeBars);
  });

  it('keeps a revisited night intact - one window must not poison another', async () => {
    // Blocks carry no id and every range query asks clip: false, so one night cannot overwrite another.
    const screen = await openOrdinaryNight(
      nightSchedule({ site: 'GS', night: '2025-11-15' }, { instrumentAvailability: [GHOST] }),
    );
    const points = () => document.querySelectorAll('[data-testid="night-timeline"] .highcharts-point').length;
    await expect.poll(points).toBeGreaterThan(0);

    await screen.getByRole('button', { name: 'Next night' }).click();
    await expect.element(screen.getByText('Night of 2025-11-15')).toBeVisible();
    await screen.getByRole('button', { name: 'Previous night' }).click();
    await expect.element(screen.getByText('Night of 2025-11-14')).toBeVisible();

    await expect.poll(points).toBeGreaterThan(0);
  });

  it('draws a Gemini North night against that site’s schedule', async () => {
    const screen = await openNight(
      '/night?site=GN&night=2026-11-14',
      publishedSemesters(GS_2026B, GN_2026B),
      nightSchedule({ site: 'GN', night: '2026-11-14' }),
    );

    await expect.element(screen.getByText('Gemini North Semester 2026B', { exact: false })).toBeVisible();
  });

  it('moves the chart clock to UT from the menu', async () => {
    // The choice keeps the axis window, so the labels prove the in-place update took the new zone.
    const screen = await renderApp({
      element: <Layout />,
      route: '/night?site=GS&night=2025-11-14',
      path: '/',
      childRoutes: [{ path: 'night', element: <NightPage /> }],
      mocks: [
        publishedSemesters(GS_2025B),
        nightSchedule({ site: 'GS', night: '2025-11-14' }, { instrumentAvailability: [GHOST] }),
      ],
    });
    const labels = () =>
      [...document.querySelectorAll('[data-testid="night-timeline"] .highcharts-xaxis-labels text')]
        .map((tick) => tick.textContent ?? '')
        .join('|');
    await expect.poll(() => labels().length).toBeGreaterThan(0);
    const siteLabels = labels();

    await chooseClock(screen, 'UTC');

    // Non-empty first: a blanked chart must not slip through as merely "different".
    await expect.element(screen.getByText('17:00 to 17:00 UTC', { exact: false })).toBeVisible();
    await expect.poll(() => labels().length).toBeGreaterThan(0);
    await expect.poll(labels).not.toBe(siteLabels);
  });

  it('heads the chart with the subsystem rows - the sensors and the laser', async () => {
    const night = overNights('GS', '2025-11-14', '2025-11-14');
    const screen = await openNight(
      '/night?site=GS&night=2025-11-14',
      publishedSemesters(GS_2025B),
      nightSchedule(
        { site: 'GS', night: '2025-11-14' },
        {
          telescopeSubsystemAvailability: [
            telescopeSubsystemAvailabilityBlock({ subsystem: 'PWFS1', interval: night }),
            telescopeSubsystemAvailabilityBlock({ subsystem: 'PWFS2', interval: night }),
            telescopeSubsystemAvailabilityBlock({ subsystem: 'LGS', interval: night, usage: 'UNAVAILABLE' }),
          ],
        },
      ),
    );

    await expect.element(screen.getByText('PWFS1').first()).toBeVisible();
    await expect.element(screen.getByText('PWFS2').first()).toBeVisible();
    // An unavailable laser is printed in words rather than shouted in the bright neutral.
    await expect.element(screen.getByText('LGS').first()).toBeVisible();
    await expect.element(screen.getByText('Not available').first()).toBeVisible();
  });

  it('reads an available laser as available, not as not available', async () => {
    const screen = await openNight(
      '/night?site=GN&night=2026-08-27',
      publishedSemesters(GN_2026B),
      nightSchedule(
        { site: 'GN', night: '2026-08-27' },
        {
          telescopeSubsystemAvailability: [
            telescopeSubsystemAvailabilityBlock({
              subsystem: 'LGS',
              interval: overNights('GN', '2026-08-27', '2026-08-27'),
            }),
          ],
        },
      ),
    );

    const chart = screen.getByTestId('night-timeline');
    await expect.element(chart).toBeVisible();
    await expect.element(chart.getByText('Available').first()).toBeVisible();
    await expect.element(chart.getByText('Not available')).not.toBeInTheDocument();
  });

  it('keeps an off-port run off the chart - the schedule is the ports picture', async () => {
    const night = overNights('GN', '2026-09-26', '2026-09-26');
    const screen = await openNight(
      '/night?site=GN&night=2026-09-26',
      publishedSemesters(GN_2026B),
      nightSchedule(
        { site: 'GN', night: '2026-09-26' },
        {
          instrumentAvailability: [
            instrumentAvailabilityBlock({ instrument: 'GMOS', port: 1, interval: night }),
            instrumentAvailabilityBlock({
              instrument: 'ALOPEKE',
              publishedName: '`Alopeke',
              place: 'FLOOR',
              interval: night,
            }),
          ],
        },
      ),
    );

    const chart = screen.getByTestId('night-timeline');
    await expect.element(chart.getByText('GMOS').first()).toBeVisible();
    await expect.element(chart.getByText('`Alopeke')).not.toBeInTheDocument();
  });

  it('keys the sky it paints - the washes are the largest thing on the chart', async () => {
    const screen = await openOrdinaryNight();
    const sky = screen.getByLabelText('Legend').getByRole('group', { name: 'Sky' });

    await expect.element(sky.getByText('Daylight')).toBeVisible();
    await expect.element(sky.getByText('Twilight')).toBeVisible();
  });

  it('keeps a bar hoverable beneath the sun wash, so the tooltip still comes', async () => {
    const screen = await openOrdinaryNight();
    await expect.element(screen.getByTestId('night-timeline')).toBeVisible();
    await expect.poll(() => document.querySelector('[data-testid="night-timeline"] .highcharts-point')).not.toBeNull();

    // The daylight wash is drawn over the bars, so it must be pointer-transparent or it eats the tooltip.
    const bar = document.querySelector('[data-testid="night-timeline"] .highcharts-point');
    await page.elementLocator(bar!).hover({ position: { x: 6, y: 8 } });

    // GHOST runs the whole semester, so this night's tooltip reads "all night".
    await expect.element(page.getByText('all night')).toBeVisible();
  });

  describe('the window it asks for', () => {
    // Literal instants: a night is 14:00 to 14:00 at the site, and the page must ask for exactly that.
    it('is 14:00 to 14:00 Chilean summer time for a November night at Gemini South', async () => {
      const screen = await openNight(
        '/night?site=GS&night=2026-11-14',
        publishedSemesters(GS_2026B),
        nightSchedule({
          site: 'GS',
          night: '2026-11-14',
          start: '2026-11-13T17:00:00.000Z',
          end: '2026-11-14T17:00:00.000Z',
        }),
      );

      await expect.element(screen.getByTestId('night-timeline')).toBeVisible();
    });

    it('is 23 hours long across the spring-forward night at Gemini South', async () => {
      // Chile springs forward inside the night labelled 2026-09-06: 14:00 at UTC-4 to 14:00 at UTC-3.
      const screen = await openNight(
        '/night?site=GS&night=2026-09-06',
        publishedSemesters(GS_2026B),
        nightSchedule({
          site: 'GS',
          night: '2026-09-06',
          start: '2026-09-05T18:00:00.000Z',
          end: '2026-09-06T17:00:00.000Z',
        }),
      );

      await expect.element(screen.getByTestId('night-timeline')).toBeVisible();
    });
  });
});
