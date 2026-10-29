import Highcharts from 'highcharts/es-modules/masters/highcharts.src.js';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
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

const weekChart = (firstNight: string, blocks: readonly InstrumentAvailabilityBlock[]) => {
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
          continuesLabel="continues"
          label="week"
          testId="chart"
        />
      </div>
    </MemoryRouter>
  );
};

/** Built per render, as a page hands the chart fresh options whenever one of its inputs changes. */
const chart = (
  continuesLabel = 'continues',
  width = 900,
  options = buildSemesterMonthOptions({ month, site: 'GS' }),
) => (
  <MemoryRouter>
    <div style={{ width: `${String(width)}px` }}>
      <TimelineChart options={options} continuesLabel={continuesLabel} label={month.label} testId="chart" />
    </div>
  </MemoryRouter>
);

const NIGHT = '2026-11-14';
const nightInterval = night(NIGHT);

/** A night whose blocks change over `changes` times, so its chart carries that many transition lines. */
const nightChart = (changes: number) => {
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

/** The line's x once a reflow has finished moving it: the same reading on three polls in a row. */
const settledNowLineX = async (): Promise<number | undefined> => {
  const recent: (number | undefined)[] = [];
  await expect
    .poll(() => {
      recent.push(nowLineX()[0]);
      return recent.length >= 3 && recent.slice(-3).every((x) => x === recent.at(-1));
    })
    .toBe(true);
  return recent.at(-1);
};

const MINUTE = 60_000;

/** The clock alone: `expect.poll` and Highcharts keep the real `setTimeout`. */
const fakeClock = (at: number): void => {
  vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
  vi.setSystemTime(at);
};

const T0 = night('2026-08-10').start;

const svgNodes = () => document.querySelectorAll('[data-testid="chart"] svg *').length;
const patternIds = () => [...document.querySelectorAll('[data-testid="chart"] svg defs pattern')].map((p) => p.id);
const liveCharts = () => Highcharts.charts.filter((c) => c !== undefined).length;
const containers = () => document.querySelectorAll('.highcharts-container').length;

interface Added {
  readonly target: string;
  readonly type: string;
  readonly listener: EventListenerOrEventListenerObject | null;
}

/** Every listener added to `target` and not yet removed. */
const trackListeners = (live: Added[], target: Window | Document, name: string): void => {
  const add = target.addEventListener.bind(target);
  const remove = target.removeEventListener.bind(target);
  vi.spyOn(target, 'addEventListener').mockImplementation((type, listener, options) => {
    live.push({ target: name, type, listener });
    add(type, listener, options);
  });
  vi.spyOn(target, 'removeEventListener').mockImplementation((type, listener, options) => {
    const index = live.findIndex(
      (entry) => entry.target === name && entry.type === type && entry.listener === listener,
    );
    if (index >= 0) {
      live.splice(index, 1);
    }
    remove(type, listener, options);
  });
};

/** One options object for the cases that change nothing but the clock or the host. */
const sharedOptions = buildSemesterMonthOptions({ month, site: 'GS' });

describe(TimelineChart, () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  /** Everything that moves the line, each proven to touch neither the bars nor `chart.update`. */
  const moves: readonly [string, (screen: Awaited<ReturnType<typeof render>>) => Promise<void> | void, 1 | -1][] = [
    [
      'a day passes',
      () => {
        vi.advanceTimersByTime(DAY);
      },
      1,
    ],
    [
      'the tab becomes visible after sleeping',
      () => {
        vi.setSystemTime(T0 + DAY);
        document.dispatchEvent(new Event('visibilitychange'));
      },
      1,
    ],
    ['the host narrows', (screen) => screen.rerender(chart('continues', 600, sharedOptions)), -1],
  ];

  it.each(moves)('moves the now marker when %s, without updating the chart', async (_case, trigger, direction) => {
    fakeClock(T0);
    const update = vi.spyOn(Highcharts.Chart.prototype, 'update');
    const screen = await render(chart('continues', 900, sharedOptions));
    await expect.poll(nowLineX).toHaveLength(1);
    const [before] = nowLineX();
    const bars = drawnBars();

    await trigger(screen);

    await expect.poll(() => Math.sign((nowLineX()[0] ?? Number.NaN) - (before ?? Number.NaN))).toBe(direction);
    expect(update).not.toHaveBeenCalled();
    expect(drawnBars()).toHaveLength(bars.length);
  });

  it('hides the marker once now leaves the window, and shows it again on return', async () => {
    fakeClock(T0);
    await render(chart());
    await expect.poll(nowLineX).toHaveLength(1);

    vi.setSystemTime(month.interval.end + DAY);
    vi.advanceTimersByTime(DAY);
    await expect.poll(nowLineX).toEqual([]);

    vi.setSystemTime(T0);
    vi.advanceTimersByTime(DAY);
    await expect.poll(nowLineX).toHaveLength(1);
  });

  /** Each view at an instant inside its window, with the band its per-pixel tick must fall in. */
  const views: readonly [string, ReactElement, number, [number, number]][] = [
    ['night', nightChart(1), nightInterval.start + 6 * HOUR, [MINUTE, 3 * MINUTE]],
    [
      'week',
      weekChart('2024-08-12', [run('ghost', 'GHOST', '2024-08-02', '2024-09-30')]),
      night('2024-08-14').start + 6 * HOUR,
      [10 * MINUTE, 15 * MINUTE],
    ],
    ['month', chart(), T0, [45 * MINUTE, 65 * MINUTE]],
  ];

  it.each(views)('moves the %s marker once per pixel of travel', async (_view, element, at, [notBefore, by]) => {
    fakeClock(at);
    await render(element);
    await expect.poll(nowLineX).toHaveLength(1);
    const [before] = nowLineX();

    vi.advanceTimersByTime(notBefore);
    expect(nowLineX()[0]).toBe(before);

    vi.advanceTimersByTime(by - notBefore);
    await expect.poll(() => nowLineX()[0]).toBeGreaterThan(before ?? Number.NaN);
  });

  it('waits longer between moves when the host narrows', async () => {
    fakeClock(T0);
    const screen = await render(chart());
    await expect.poll(nowLineX).toHaveLength(1);
    const [wide] = nowLineX();

    await screen.rerender(chart('continues', 600));
    const narrow = await settledNowLineX();
    expect(narrow).toBeLessThan(wide ?? Number.NaN);

    vi.advanceTimersByTime(65 * MINUTE);
    expect(nowLineX()[0]).toBe(narrow);

    vi.advanceTimersByTime(45 * MINUTE);
    await expect.poll(() => nowLineX()[0]).toBeGreaterThan(narrow ?? Number.NaN);
  });

  it('redraws every block in place and keeps the marker when the options change', async () => {
    fakeClock(T0);
    const update = vi.spyOn(Highcharts.Chart.prototype, 'update');
    const screen = await render(chart());
    await expect.poll(() => drawnLabels()).toStrictEqual(['Open', 'GHOST', 'GMOS-S']);
    await expect.poll(nowLineX).toHaveLength(1);
    const bars = drawnBars();
    const marker = nowLineX();
    expect(bars).toHaveLength(3);

    await screen.rerender(chart('runs on'));

    await expect.poll(() => update.mock.calls.length).toBe(1);
    await expect.poll(() => drawnLabels()).toStrictEqual(['Open', 'GHOST', 'GMOS-S']);
    await expect.poll(() => drawnBars()).toStrictEqual(bars);
    expect(nowLineX()).toEqual(marker);
  });

  /* The week page's sequence: a loading week draws empty, the next week draws one run, and stepping back redraws the cached one. */
  it('draws other data on the right rows, and carries the marker, across a window change and back', async () => {
    const ghost = run('ghost', 'GHOST', '2024-08-02', '2024-08-14');
    const gmos = run('gmos', 'GMOS', '2024-08-15', '2024-09-30');
    fakeClock(night('2024-08-14').start + 6 * HOUR);
    const screen = await render(weekChart('2024-08-12', [ghost, gmos]));
    await expect.poll(() => drawnLabels()).toStrictEqual(['GHOST', 'GMOS']);
    await expect.poll(nowLineX).toHaveLength(1);
    const home = drawnBars();
    const marker = nowLineX();

    await screen.rerender(weekChart('2024-08-19', []));
    await expect.poll(() => drawnBars()).toStrictEqual([]);
    await screen.rerender(weekChart('2024-08-19', [gmos]));
    await expect.poll(() => drawnLabels()).toStrictEqual(['GMOS']);
    await expect.poll(nowLineX).toEqual([]);
    await screen.rerender(weekChart('2024-08-12', [ghost, gmos]));

    await expect.poll(() => drawnLabels()).toStrictEqual(['GHOST', 'GMOS']);
    await expect.poll(() => drawnBars()).toStrictEqual(home);
    expect(nowLineX()).toEqual(marker);
  });

  /* Highcharts matches an un-id'd plot line by index on update, so a transition that appears must not land on the marker's slot. */
  it('keeps the marker and every transition line when the line count grows', async () => {
    fakeClock(nightInterval.start + 10 * HOUR);
    const screen = await render(nightChart(1));
    await expect.poll(() => drawnPlotLineX('.night-transition')).toHaveLength(1);
    await expect.poll(nowLineX).toHaveLength(1);
    const marker = nowLineX();

    await screen.rerender(nightChart(2));

    await expect.poll(() => drawnPlotLineX('.night-transition')).toHaveLength(2);
    expect(nowLineX()).toEqual(marker);
    expect(document.querySelectorAll('.schedule-today')).toHaveLength(1);
  });

  describe('leaves nothing behind', () => {
    it('adds no svg node or pattern def across 200 now ticks', async () => {
      fakeClock(T0 + 6 * HOUR);
      await render(chart('continues', 900, sharedOptions));
      await expect.poll(nowLineX).toHaveLength(1);
      const nodes = svgNodes();
      const ids = patternIds();
      expect(ids).toHaveLength(1);

      for (let round = 1; round <= 200; round += 1) {
        vi.advanceTimersByTime(HOUR);
      }

      expect(svgNodes()).toBe(nodes);
      expect(patternIds()).toStrictEqual(ids);
      expect(document.querySelectorAll('.highcharts-plot-line.schedule-today')).toHaveLength(1);
    });

    // Highcharts arms one 500 ms data-label fade (SVGElement.animate) that destroy() does not clear, so the clock runs past it first.
    it('leaves no chart, container, timer or listener behind on unmount', async () => {
      vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
      vi.setSystemTime(T0 + 6 * HOUR);
      const live: Added[] = [];
      trackListeners(live, window, 'window');
      trackListeners(live, document, 'document');
      const chartsBefore = liveCharts();
      const containersBefore = containers();

      const screen = await render(chart('continues', 900, sharedOptions));
      expect(nowLineX()).toHaveLength(1);
      expect(liveCharts()).toBe(chartsBefore + 1);
      expect(containers()).toBe(containersBefore + 1);
      expect(live.length).toBeGreaterThan(0);
      expect(vi.getTimerCount()).toBeGreaterThan(0);

      vi.advanceTimersByTime(HOUR);
      await screen.unmount();

      expect(liveCharts()).toBe(chartsBefore);
      expect(containers()).toBe(containersBefore);
      expect(vi.getTimerCount()).toBe(0);
      expect(live.map((entry) => `${entry.target}:${entry.type}`)).toStrictEqual([]);
    });
  });
});
