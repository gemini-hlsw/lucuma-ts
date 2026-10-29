import Highcharts from 'highcharts/es-modules/masters/highcharts.src.js';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';

import { buildNightTimeline } from '@/domain/nightTimeline';
import { buildSemesterTimeline } from '@/domain/semesterTimeline';
import { observingNightInterval } from '@/domain/siteTime';
import type { InstrumentAvailabilityBlock } from '@/domain/types';
import { buildWeekTimeline } from '@/domain/weekTimeline';
import { buildNightChartOptions } from '@/features/night/nightChartOptions';
import { buildSemesterMonthOptions } from '@/features/semester/semesterMonthOptions';
import { buildWeekChartOptions } from '@/features/week/weekChartOptions';
import { drawnPlotLineX } from '@/test/helpers';

import { TimelineChart } from './TimelineChart';

const night = (label: string) => observingNightInterval('GS', label);
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const block = (
  id: string,
  instrument: 'GHOST' | 'GMOS',
  interval: InstrumentAvailabilityBlock['interval'],
  over: Partial<InstrumentAvailabilityBlock> = {},
): InstrumentAvailabilityBlock => ({
  id,
  instrument,
  publishedName: instrument,
  usage: 'SCIENCE',
  port: 1,
  place: null,
  note: null,
  interval,
  ...over,
});

/** Three rows whose blocks all begin the same night, which is the ordinary shape of a semester's first night. */
const month = buildSemesterTimeline({
  site: 'GS',
  firstNight: '2026-08-02',
  lastNight: '2026-09-01',
  instrumentAvailability: [
    block('ghost', 'GHOST', { start: night('2026-08-02').start, end: night('2026-08-20').end }),
    block(
      'gmos',
      'GMOS',
      { start: night('2026-08-02').start, end: night('2026-08-30').end },
      { publishedName: 'GMOS-S', usage: 'ENGINEERING', port: 2 },
    ),
  ],
  telescopeAvailability: [
    {
      id: 'open',
      availability: 'OPEN',
      port: null,
      reason: null,
      interval: { start: night('2026-08-02').start, end: night('2026-08-14').end },
    },
  ],
}).months[0]!;

const run = (id: string, instrument: 'GHOST' | 'GMOS', from: string, to: string): InstrumentAvailabilityBlock =>
  block(id, instrument, { start: night(from).start, end: night(to).end });

const weekChart = (firstNight: string, blocks: readonly InstrumentAvailabilityBlock[], now?: number) => {
  const week = buildWeekTimeline({
    site: 'GS',
    firstNight,
    instrumentAvailability: blocks,
    telescopeAvailability: [],
    nightsWithData: undefined,
  });
  return (
    <MemoryRouter>
      <div style={{ width: '900px' }}>
        <TimelineChart
          options={buildWeekChartOptions({ week, site: 'GS' })}
          {...(now === undefined ? {} : { now })}
          continuesLabel="continues"
          label="week"
          testId="chart"
        />
      </div>
    </MemoryRouter>
  );
};

/** Built once, as a page's memoised builder hands the chart the same object across ticks. */
const monthOptions = buildSemesterMonthOptions({ month, site: 'GS' });

const chart = (now: number, continuesLabel = 'continues', width = 900) => (
  <MemoryRouter>
    <div style={{ width: `${String(width)}px` }}>
      <TimelineChart
        options={monthOptions}
        now={now}
        continuesLabel={continuesLabel}
        label={month.label}
        testId="chart"
      />
    </div>
  </MemoryRouter>
);

const NIGHT = '2026-11-14';
const nightInterval = night(NIGHT);

/** A night whose blocks change over `changes` times, so its chart carries that many transition lines. */
const nightChart = (changes: number, now: number) => {
  const timeline = buildNightTimeline({
    site: 'GS',
    observingNight: NIGHT,
    instrumentAvailability: Array.from({ length: changes + 1 }, (_, index) =>
      block(`b${String(index)}`, index % 2 === 0 ? 'GHOST' : 'GMOS', {
        start: index === 0 ? nightInterval.start - DAY : nightInterval.start + index * 3 * HOUR,
        end: index === changes ? nightInterval.end + DAY : nightInterval.start + (index + 1) * 3 * HOUR,
      }),
    ),
    telescopeAvailability: [],
  });
  expect(timeline.transitions).toHaveLength(changes);
  return (
    <MemoryRouter>
      <div style={{ width: '900px' }}>
        <TimelineChart
          options={buildNightChartOptions({ night: timeline, site: 'GS', timeDisplay: 'site' })}
          now={now}
          continuesLabel="continues"
          label="night"
          testId="chart"
        />
      </div>
    </MemoryRouter>
  );
};

/** Each bar's geometry and fill, with the pattern's per-render hash dropped. */
const drawnBars = () =>
  [...document.querySelectorAll('path.highcharts-point')].map(
    (bar) =>
      `${bar.getAttribute('d') ?? ''}#${(bar.getAttribute('fill') ?? '').replace(/pattern-\d+-\w+/u, 'pattern')}`,
  );

const drawnLabels = () =>
  [...document.querySelectorAll('.highcharts-data-label text')].map((label) => label.textContent?.trim() ?? '');

const nowLineX = () => drawnPlotLineX('.schedule-today');

describe(TimelineChart, () => {
  it('moves the now marker without updating the chart', async () => {
    const update = vi.spyOn(Highcharts.Chart.prototype, 'update');
    const t0 = night('2026-08-10').start;
    const screen = await render(chart(t0));
    await expect.poll(nowLineX).toHaveLength(1);
    const [before] = nowLineX();
    const bars = drawnBars();

    await screen.rerender(chart(t0 + DAY));

    await expect.poll(nowLineX).not.toEqual([before]);
    expect(nowLineX()[0]).toBeGreaterThan(before ?? Number.NaN);
    expect(update).not.toHaveBeenCalled();
    expect(drawnBars()).toStrictEqual(bars);
  });

  it('follows the container when it is resized, with no update of its own', async () => {
    const update = vi.spyOn(Highcharts.Chart.prototype, 'update');
    const t0 = night('2026-08-10').start;
    const screen = await render(chart(t0));
    await expect.poll(nowLineX).toHaveLength(1);
    const [wide] = nowLineX();

    await screen.rerender(chart(t0, 'continues', 600));

    await expect.poll(() => nowLineX()[0]).toBeLessThan(wide ?? Number.NaN);
    expect(update).not.toHaveBeenCalled();
  });

  it('hides the marker once now leaves the window, and shows it again on return', async () => {
    const t0 = night('2026-08-10').start;
    const screen = await render(chart(t0));
    await expect.poll(nowLineX).toHaveLength(1);

    await screen.rerender(chart(month.interval.end + DAY));
    await expect.poll(nowLineX).toEqual([]);

    await screen.rerender(chart(t0));
    await expect.poll(nowLineX).toHaveLength(1);
  });

  it('keeps the marker where it was when the options change', async () => {
    const update = vi.spyOn(Highcharts.Chart.prototype, 'update');
    const t0 = night('2026-08-10').start;
    const screen = await render(chart(t0));
    await expect.poll(nowLineX).toHaveLength(1);
    const before = nowLineX();

    await screen.rerender(chart(t0, 'runs on'));

    await expect.poll(() => update.mock.calls.length).toBe(1);
    await expect.poll(nowLineX).toEqual(before);
  });

  it('redraws every block in place when the options change', async () => {
    const t0 = night('2026-08-10').start;
    const screen = await render(chart(t0));
    await expect.poll(() => drawnLabels()).toStrictEqual(['Open', 'GHOST', 'GMOS-S']);
    const bars = drawnBars();
    expect(bars).toHaveLength(3);

    await screen.rerender(chart(t0, 'runs on'));

    await expect.poll(() => drawnLabels()).toStrictEqual(['Open', 'GHOST', 'GMOS-S']);
    await expect.poll(() => drawnBars()).toStrictEqual(bars);
  });

  /* The week page's sequence: a loading week draws empty, the next week draws one run, and stepping back redraws the cached one. */
  it('draws other data on the right rows after a window change', async () => {
    const ghost = run('ghost', 'GHOST', '2024-08-02', '2024-08-14');
    const gmos = run('gmos', 'GMOS', '2024-08-15', '2024-09-30');
    const screen = await render(weekChart('2024-08-12', [ghost, gmos]));
    await expect.poll(() => drawnLabels()).toStrictEqual(['GHOST', 'GMOS']);
    const home = drawnBars();

    await screen.rerender(weekChart('2024-08-19', []));
    await expect.poll(() => drawnBars()).toStrictEqual([]);
    await screen.rerender(weekChart('2024-08-19', [gmos]));
    await expect.poll(() => drawnLabels()).toStrictEqual(['GMOS']);
    await screen.rerender(weekChart('2024-08-12', [ghost, gmos]));

    await expect.poll(() => drawnLabels()).toStrictEqual(['GHOST', 'GMOS']);
    await expect.poll(() => drawnBars()).toStrictEqual(home);
  });

  it('carries the marker from a week it falls in to one it does not, and back', async () => {
    const ghost = run('ghost', 'GHOST', '2024-08-02', '2024-09-30');
    const now = night('2024-08-14').start + 6 * HOUR;
    const screen = await render(weekChart('2024-08-12', [ghost], now));
    await expect.poll(nowLineX).toHaveLength(1);
    const home = nowLineX();

    await screen.rerender(weekChart('2024-08-19', [ghost], now));
    await expect.poll(() => drawnLabels()).toStrictEqual(['GHOST']);
    await expect.poll(nowLineX).toEqual([]);

    await screen.rerender(weekChart('2024-08-12', [ghost], now));
    await expect.poll(nowLineX).toEqual(home);
  });

  /* Highcharts matches an un-id'd plot line by index on update, so a transition that appears must not land on the marker's slot. */
  it('keeps the marker and every transition line when the line count grows', async () => {
    const now = nightInterval.start + 10 * HOUR;
    const screen = await render(nightChart(1, now));
    await expect.poll(() => drawnPlotLineX('.night-transition')).toHaveLength(1);
    await expect.poll(nowLineX).toHaveLength(1);
    const marker = nowLineX();

    await screen.rerender(nightChart(2, now));

    await expect.poll(() => drawnPlotLineX('.night-transition')).toHaveLength(2);
    expect(nowLineX()).toEqual(marker);
    expect(document.querySelectorAll('.schedule-today')).toHaveLength(1);
  });
});
