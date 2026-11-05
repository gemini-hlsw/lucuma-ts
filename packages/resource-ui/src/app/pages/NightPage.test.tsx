import type { MockLink } from '@apollo/client/testing';
import Highcharts from 'highcharts/es-modules/masters/highcharts.src.js';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { HOUR_MS, observingNightInterval, observingNightOf } from '@/domain/siteTime';
import { TOO_SUPPORT_LABEL } from '@/domain/timeline';
import { drawnBars, drawnPlotLineX, nightAxisLabels } from '@/test/chartProbe';
import {
  instrumentAvailabilityBlock,
  overNights,
  telescopeAvailabilityBlock,
  telescopeClosure,
  tooSupportBlock,
} from '@/test/fixtures/blocks';
import { type NightRow, nightSchedule } from '@/test/fixtures/night';
import { publishedSemester, wholeSemester } from '@/test/fixtures/semester';
import { chooseClock, fakeClock } from '@/test/helpers';
import { renderInShell, renderWithRoute } from '@/test/render';

import NightPage from './NightPage';

const GHOST = instrumentAvailabilityBlock({
  instrument: 'GHOST',
  at: { port: 1 },
  interval: wholeSemester(publishedSemester({ site: 'GS', semester: '2025B' })),
});

const nightUrl = ({ site, night }: NightRow) => `/night?site=${site}&night=${night}`;

const openNight = (route: string, ...mocks: MockLink.MockedResponse[]) =>
  renderWithRoute(<NightPage />, { route, mocks });

/** The night a row names, answered with its blocks; the URL is not the subject here. */
const openNightOf = (row: NightRow, blocks?: Parameters<typeof nightSchedule>[1], ...more: MockLink.MockedResponse[]) =>
  openNight(nightUrl(row), nightSchedule(row, blocks), ...more);

const ORDINARY_NIGHT: NightRow = { site: 'GS', night: '2025-11-14' };

/** The ordinary night most tests open. */
const openOrdinaryNight = (...more: MockLink.MockedResponse[]) =>
  openNightOf(ORDINARY_NIGHT, { instrumentAvailability: [GHOST] }, ...more);

const chartBars = () => drawnBars('[data-testid="night-timeline"]');

afterEach(() => {
  vi.useRealTimers();
});

describe(NightPage, () => {
  it('drops the Now key when the night ends, without updating the chart', async () => {
    fakeClock(observingNightInterval('GS', '2025-11-14').start + 6 * HOUR_MS, { shouldAdvanceTime: true });
    const update = vi.spyOn(Highcharts.Chart.prototype, 'update');
    const screen = await openOrdinaryNight();
    const calendar = screen.getByRole('group', { name: 'Calendar' });
    await expect.element(calendar.getByText('Now')).toBeVisible();
    await expect.poll(() => drawnPlotLineX('.schedule-today')).toHaveLength(1);
    const updates = update.mock.calls.length;

    vi.advanceTimersByTime(24 * HOUR_MS);

    await expect.element(calendar.getByText('Now')).not.toBeInTheDocument();
    expect(update.mock.calls.length).toBe(updates);
  });

  describe('the telescope-state rows', () => {
    it('draws a shutdown as a closed Telescope row, and an unrecorded mode as no Mode row at all', async () => {
      const shutdown = overNights('GS', '2024-08-02', '2024-08-16');
      const screen = await openNightOf(
        { site: 'GS', night: '2024-08-05' },
        {
          telescopeAvailability: [telescopeClosure({ interval: shutdown, reason: 'Shutdown' })],
          tooSupport: [tooSupportBlock({ interval: shutdown })],
        },
      );

      const legend = screen.getByLabelText('Legend');
      await expect.element(legend.getByRole('group', { name: 'Telescope' }).getByText('Closed')).toBeVisible();
      await expect
        .element(legend.getByRole('group', { name: 'ToO' }).getByText(TOO_SUPPORT_LABEL.STANDARD))
        .toBeVisible();
      // A gap is not recorded, so the mode is not drawn as anything - not Queue, not Shutdown.
      await expect.element(legend.getByRole('group', { name: 'Mode' })).not.toBeInTheDocument();
    });

    it('leaves a stretch the Telescope row does not record empty, never reading it as closed', async () => {
      // Open for the first night only: the second night is a gap in the telescope's record.
      const screen = await openNightOf(
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
      );

      await expect.element(screen.getByTestId('night-timeline')).toBeVisible();
      await expect.poll(() => chartBars().length).toBeGreaterThan(0);
      await expect.element(screen.getByText('Closed')).not.toBeInTheDocument();
    });
  });

  describe('the night the backend holds nothing for', () => {
    it('says nothing is recorded, rather than drawing an empty chart', async () => {
      const screen = await openNightOf(ORDINARY_NIGHT, { dataAvailable: false });

      await expect.element(screen.getByText('Nothing is recorded for this night', { exact: false })).toBeVisible();
      await expect.element(screen.getByTestId('night-timeline')).not.toBeInTheDocument();
    });
  });

  it('reads an unknown stored clock as the site clock, never as UT or blank', async () => {
    // Storage is shared with whatever wrote it last, including an older build of this app.
    localStorage.setItem('resource.clock', 'zulu');
    await openOrdinaryNight();

    await expect.poll(() => nightAxisLabels()[0]).toBe('14:00');
  });

  it('draws the night, one row per published port', async () => {
    const screen = await openOrdinaryNight();

    await expect.element(screen.getByText('Night of 2025-11-14')).toBeVisible();
    await expect.element(screen.getByTestId('night-timeline')).toBeVisible();
    await expect.element(screen.getByText('GHOST').first()).toBeVisible();
  });

  it('draws the night in the site clock', async () => {
    await openOrdinaryNight();

    // 14:00 to 14:00 at Cerro Pachon, whatever zone the reader is in.
    await expect.poll(() => nightAxisLabels()[0]).toBe('14:00');
  });

  it('says nothing is recorded for a night no published semester covers', async () => {
    const screen = await openNightOf({ site: 'GS', night: '2030-01-01' }, { dataAvailable: false });

    await expect.element(screen.getByText('Nothing is recorded for this night', { exact: false })).toBeVisible();
  });

  it('draws no timeline when the night query fails, rather than an empty one beside the alert', async () => {
    const screen = await openNight(nightUrl(ORDINARY_NIGHT), {
      request: nightSchedule(ORDINARY_NIGHT).request,
      error: new Error('the Resource service did not answer'),
    });

    // Settle on the failure first, so the absences below are read after the query resolved.
    await expect.element(screen.getByRole('alert')).toMatchTextContent('the Resource service did not answer');

    await expect.element(screen.getByTestId('night-timeline')).not.toBeInTheDocument();
    // A query that never arrived is not a recorded absence, and must not be reported as one.
    await expect
      .element(screen.getByText('Nothing is recorded for this night', { exact: false }))
      .not.toBeInTheDocument();
  });

  it('jumps back to the night in progress from a deep link', async () => {
    // Derived with the page's own function: Tonight is the one control that must follow the wall clock.
    const tonight = observingNightOf('GS', Date.now());
    const screen = await openOrdinaryNight(nightSchedule({ site: 'GS', night: tonight }));
    await expect.element(screen.getByText('Night of 2025-11-14')).toBeVisible();

    await screen.getByRole('button', { name: 'Tonight' }).click();

    await expect.element(screen.getByText(`Night of ${tonight}`)).toBeVisible();
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
    const screen = await openNightOf(
      { site: 'GS', night: '2024-08-16' },
      {
        telescopeAvailability: [telescopeClosure({ interval: overNights('GS', '2024-08-16', '2024-08-16') })],
      },
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
    await expect.poll(() => chartBars().length).toBeGreaterThan(0);

    await screen.getByRole('button', { name: 'Next night' }).click();
    await expect.element(screen.getByText('Night of 2025-11-15')).toBeVisible();
    await screen.getByRole('button', { name: 'Previous night' }).click();
    await expect.element(screen.getByText('Night of 2025-11-14')).toBeVisible();

    await expect.poll(() => chartBars().length).toBeGreaterThan(0);
  });

  it('draws a Gemini North night against that site’s schedule', async () => {
    const screen = await openNightOf({ site: 'GN', night: '2026-11-14' });

    await expect.element(screen.getByText('Night of 2026-11-14')).toBeVisible();
    await expect.element(screen.getByTestId('night-timeline')).toBeVisible();
  });

  it('moves the chart clock to UT from the menu', async () => {
    // The choice keeps the axis window, so the labels prove the in-place update took the new zone.
    const screen = await renderInShell(<NightPage />, {
      route: nightUrl(ORDINARY_NIGHT),
      mocks: [nightSchedule(ORDINARY_NIGHT, { instrumentAvailability: [GHOST] })],
    });
    const labels = () => nightAxisLabels().join('|');
    await expect.poll(() => labels().length).toBeGreaterThan(0);
    const siteLabels = labels();

    await chooseClock(screen, 'UTC');

    // Non-empty first: a blanked chart must not slip through as merely "different".
    await expect.poll(() => labels().length).toBeGreaterThan(0);
    await expect.poll(labels).not.toBe(siteLabels);
  });

  it('keeps an off-port run off the chart - the schedule is the ports picture', async () => {
    const night = overNights('GN', '2026-09-26', '2026-09-26');
    const screen = await openNightOf(
      { site: 'GN', night: '2026-09-26' },
      {
        instrumentAvailability: [
          instrumentAvailabilityBlock({ instrument: 'GMOS', at: { port: 1 }, interval: night }),
          instrumentAvailabilityBlock({
            instrument: 'ALOPEKE',
            publishedName: '`Alopeke',
            at: { place: 'FLOOR' },
            interval: night,
          }),
        ],
      },
    );

    const chart = screen.getByTestId('night-timeline');
    await expect.element(chart.getByText('GMOS').first()).toBeVisible();
    await expect.element(chart.getByText('`Alopeke')).not.toBeInTheDocument();
  });

  describe('the window it asks for', () => {
    // Literal instants: a night is 14:00 to 14:00 at the site, and the page must ask for exactly that.
    it('is 14:00 to 14:00 Chilean summer time for a November night at Gemini South', async () => {
      const screen = await openNight(
        '/night?site=GS&night=2026-11-14',
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
