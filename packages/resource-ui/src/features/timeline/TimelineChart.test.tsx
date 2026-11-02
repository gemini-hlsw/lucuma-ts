// The one stylesheet a test loads: a Highcharts overlay that catches the pointer swallows the hover.
import '@/styles/chartOverlays.css';

import type { Options } from 'highcharts';
import Highcharts from 'highcharts/es-modules/masters/highcharts.src.js';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-react';

import { buildNightTimeline } from '@/domain/nightTimeline';
import { buildSemesterTimeline } from '@/domain/semesterTimeline';
import { DAY_MS, HOUR_MS, observingNightInterval } from '@/domain/siteTime';
import type { InstrumentAvailabilityBlock } from '@/domain/types';
import { buildWeekTimeline } from '@/domain/weekTimeline';
import { buildNightChartOptions } from '@/features/night/nightChartOptions';
import { buildSemesterMonthOptions } from '@/features/semester/semesterMonthOptions';
import { buildWeekChartOptions } from '@/features/week/weekChartOptions';
import { drawnBars, drawnPlotLineX } from '@/test/chartProbe';
import { domainInstrumentBlock, domainTelescopeBlock, nightsSpan, scheduleOf } from '@/test/fixtures/domain';
import { fakeClock } from '@/test/helpers';
import { renderWithContext } from '@/test/render';

import { TimelineChart } from './TimelineChart';

const night = (label: string) => observingNightInterval('GS', label);

/** Three rows whose blocks all begin the same night, which is the ordinary shape of a semester's first night. */
const month = buildSemesterTimeline({
  site: 'GS',
  firstNight: '2026-08-02',
  lastNight: '2026-09-01',
  schedule: scheduleOf({
    instrumentAvailability: [
      domainInstrumentBlock({
        id: 'ghost',
        instrument: 'GHOST',
        interval: nightsSpan('GS', '2026-08-02', '2026-08-20'),
      }),
      domainInstrumentBlock({
        id: 'gmos',
        instrument: 'GMOS',
        publishedName: 'GMOS-S',
        usage: 'ENGINEERING',
        port: 2,
        interval: nightsSpan('GS', '2026-08-02', '2026-08-30'),
      }),
    ],
    telescopeAvailability: [
      domainTelescopeBlock({
        id: 'open',
        interval: nightsSpan('GS', '2026-08-02', '2026-08-14'),
      }),
    ],
  }),
}).months[0]!;

const run = (id: string, instrument: 'GHOST' | 'GMOS', from: string, to: string): InstrumentAvailabilityBlock =>
  domainInstrumentBlock({ id, instrument, interval: nightsSpan('GS', from, to) });

interface Frame {
  readonly label: string;
  readonly continuesLabel?: string;
  readonly width?: number;
  readonly onInstantClick?: (instant: number) => void;
}

/** The chart in a sized host, as a page frames it. */
const framed = (options: Options, { label, continuesLabel = 'continues', width = 900, onInstantClick }: Frame) => (
  <div style={{ width: `${String(width)}px` }}>
    <TimelineChart
      options={options}
      continuesLabel={continuesLabel}
      label={label}
      testId="chart"
      {...(onInstantClick === undefined ? {} : { onInstantClick })}
    />
  </div>
);

const weekChart = (
  firstNight: string,
  blocks: readonly InstrumentAvailabilityBlock[],
  onInstantClick?: (instant: number) => void,
) => {
  const week = buildWeekTimeline({
    site: 'GS',
    firstNight,
    schedule: scheduleOf({ instrumentAvailability: blocks }),
    nightsWithData: undefined,
  });
  return framed(buildWeekChartOptions({ week, site: 'GS' }), {
    label: 'week',
    ...(onInstantClick === undefined ? {} : { onInstantClick }),
  });
};

/** Built per render, as a page hands the chart fresh options whenever one of its inputs changes. */
const chart = (continuesLabel = 'continues', width = 900, options = buildSemesterMonthOptions({ month, site: 'GS' })) =>
  framed(options, { label: month.label, continuesLabel, width });

const NIGHT = '2026-11-14';
const nightInterval = night(NIGHT);

/** A night whose blocks change over `changes` times, so its chart carries that many transition lines. */
const nightChart = (changes: number, continuesLabel = 'continues') => {
  const timeline = buildNightTimeline({
    site: 'GS',
    observingNight: NIGHT,
    schedule: scheduleOf({
      instrumentAvailability: Array.from({ length: changes + 1 }, (_, index) =>
        domainInstrumentBlock({
          id: `b${String(index)}`,
          instrument: index % 2 === 0 ? 'GHOST' : 'GMOS',
          interval: {
            start: index === 0 ? nightInterval.start - DAY_MS : nightInterval.start + index * 3 * HOUR_MS,
            end: index === changes ? nightInterval.end + DAY_MS : nightInterval.start + (index + 1) * 3 * HOUR_MS,
          },
        }),
      ),
    }),
  });
  expect(timeline.transitions).toHaveLength(changes);
  return framed(buildNightChartOptions({ night: timeline, site: 'GS', timeDisplay: 'site' }), {
    label: 'night',
    continuesLabel,
  });
};

const chartBars = () => drawnBars('[data-testid="chart"]', { patternHash: 'drop' });
const barCount = () => document.querySelectorAll('[data-testid="chart"] path.highcharts-point').length;

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

describe(TimelineChart, () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  /** Everything that moves the line, each proven to touch neither the bars nor `chart.update`. */
  const moves: readonly [
    string,
    (screen: Awaited<ReturnType<typeof render>>, options: Options) => Promise<void> | void,
    1 | -1,
  ][] = [
    [
      'a day passes',
      () => {
        vi.advanceTimersByTime(DAY_MS);
      },
      1,
    ],
    [
      'the tab becomes visible after sleeping',
      () => {
        vi.setSystemTime(T0 + DAY_MS);
        document.dispatchEvent(new Event('visibilitychange'));
      },
      1,
    ],
    ['the host narrows', (screen, options) => screen.rerender(chart('continues', 600, options)), -1],
  ];

  // Highcharts writes each tick's value into the plot-line object it was given, so no options outlive their test.
  it.each(moves)('moves the now marker when %s, without updating the chart', async (_case, trigger, direction) => {
    fakeClock(T0);
    const update = vi.spyOn(Highcharts.Chart.prototype, 'update');
    const options = buildSemesterMonthOptions({ month, site: 'GS' });
    const screen = await render(chart('continues', 900, options));
    await expect.poll(nowLineX).toHaveLength(1);
    const [before] = nowLineX();
    const bars = barCount();

    await trigger(screen, options);

    await expect.poll(() => Math.sign((nowLineX()[0] ?? Number.NaN) - (before ?? Number.NaN))).toBe(direction);
    expect(update).not.toHaveBeenCalled();
    expect(barCount()).toBe(bars);
  });

  it('hides the marker once now leaves the window, and shows it again on return', async () => {
    fakeClock(T0);
    await render(chart());
    await expect.poll(nowLineX).toHaveLength(1);

    vi.setSystemTime(month.interval.end + DAY_MS);
    vi.advanceTimersByTime(DAY_MS);
    await expect.poll(nowLineX).toEqual([]);

    vi.setSystemTime(T0);
    vi.advanceTimersByTime(DAY_MS);
    await expect.poll(nowLineX).toHaveLength(1);
  });

  /** Each view at an instant inside its window, with the band its per-pixel tick must fall in. */
  const views: readonly [string, ReactElement, number, [number, number]][] = [
    ['night', nightChart(1), nightInterval.start + 6 * HOUR_MS, [MINUTE, 3 * MINUTE]],
    [
      'week',
      weekChart('2024-08-12', [run('ghost', 'GHOST', '2024-08-02', '2024-09-30')]),
      night('2024-08-14').start + 6 * HOUR_MS,
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
    const bars = chartBars();
    const marker = nowLineX();
    expect(barCount()).toBe(3);

    await screen.rerender(chart('runs on'));

    await expect.poll(() => update.mock.calls.length).toBe(1);
    await expect.poll(() => drawnLabels()).toStrictEqual(['Open', 'GHOST', 'GMOS-S']);
    await expect.poll(chartBars).toBe(bars);
    expect(nowLineX()).toEqual(marker);
  });

  /* The week page's sequence: a loading week draws empty, the next week draws one run, and stepping back redraws the cached one. */
  it('draws other data on the right rows, and carries the marker, across a window change and back', async () => {
    const ghost = run('ghost', 'GHOST', '2024-08-02', '2024-08-14');
    const gmos = run('gmos', 'GMOS', '2024-08-15', '2024-09-30');
    fakeClock(night('2024-08-14').start + 6 * HOUR_MS);
    const screen = await render(weekChart('2024-08-12', [ghost, gmos]));
    await expect.poll(() => drawnLabels()).toStrictEqual(['GHOST', 'GMOS']);
    await expect.poll(nowLineX).toHaveLength(1);
    const home = chartBars();
    const marker = nowLineX();

    await screen.rerender(weekChart('2024-08-19', []));
    await expect.poll(chartBars).toBe('');
    await screen.rerender(weekChart('2024-08-19', [gmos]));
    await expect.poll(() => drawnLabels()).toStrictEqual(['GMOS']);
    await expect.poll(nowLineX).toEqual([]);
    await screen.rerender(weekChart('2024-08-12', [ghost, gmos]));

    await expect.poll(() => drawnLabels()).toStrictEqual(['GHOST', 'GMOS']);
    await expect.poll(chartBars).toBe(home);
    expect(nowLineX()).toEqual(marker);
  });

  /* Highcharts matches an un-id'd plot line by index on update, so a transition that appears must not land on the marker's slot. */
  it('keeps the marker and every transition line when the line count grows', async () => {
    fakeClock(nightInterval.start + 10 * HOUR_MS);
    const screen = await render(nightChart(1));
    await expect.poll(() => drawnPlotLineX('.night-transition')).toHaveLength(1);
    await expect.poll(nowLineX).toHaveLength(1);
    const marker = nowLineX();

    await screen.rerender(nightChart(2));

    await expect.poll(() => drawnPlotLineX('.night-transition')).toHaveLength(2);
    expect(nowLineX()).toEqual(marker);
    expect(document.querySelectorAll('.schedule-today')).toHaveLength(1);
  });

  it('should show the point’s tooltip, phrased with the continues label, when a bar is hovered', async () => {
    await renderWithContext(nightChart(1, 'runs on'));
    await expect.poll(() => document.querySelector('[data-testid="chart"] .highcharts-point')).not.toBeNull();

    const bar = document.querySelector('[data-testid="chart"] .highcharts-point');
    await page.elementLocator(bar!).hover({ position: { x: 6, y: 8 } });

    const tooltip = page.elementLocator(document.querySelector('.highcharts-tooltip')!);
    await expect.element(tooltip.getByText('GHOST')).toBeVisible();
    await expect.element(tooltip.getByText(/, runs on$/u)).toBeVisible();
  });

  it('should hand over the instant under the cursor, not the bar’s start, when a bar is clicked', async () => {
    const onInstantClick = vi.fn<(instant: number) => void>();
    await renderWithContext(
      weekChart('2024-08-12', [run('ghost', 'GHOST', '2024-08-02', '2024-09-30')], onInstantClick),
    );
    await expect.poll(() => document.querySelector('[data-testid="chart"] .highcharts-point')).not.toBeNull();

    const bar = document.querySelector('[data-testid="chart"] .highcharts-point')!;
    const { width, height } = bar.getBoundingClientRect();
    await page.elementLocator(bar).click({ position: { x: width - 4, y: height / 2 } });

    expect(onInstantClick).toHaveBeenCalledTimes(1);
    const instant = onInstantClick.mock.calls[0]![0];
    expect(instant).toBeGreaterThanOrEqual(night('2024-08-18').start);
    expect(instant).toBeLessThanOrEqual(night('2024-08-18').end);
  });

  describe('leaves nothing behind', () => {
    it('adds no svg node or pattern def across 200 now ticks', async () => {
      fakeClock(T0 + 6 * HOUR_MS);
      await render(chart());
      await expect.poll(nowLineX).toHaveLength(1);
      const nodes = svgNodes();
      const ids = patternIds();
      expect(ids).toHaveLength(1);

      for (let round = 1; round <= 200; round += 1) {
        vi.advanceTimersByTime(HOUR_MS);
      }

      expect(svgNodes()).toBe(nodes);
      expect(patternIds()).toStrictEqual(ids);
      expect(document.querySelectorAll('.highcharts-plot-line.schedule-today')).toHaveLength(1);
    });

    // Highcharts arms one 500 ms data-label fade (SVGElement.animate) that destroy() does not clear, so the clock runs past it first.
    it('leaves no chart, container, timer or listener behind on unmount', async () => {
      vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
      vi.setSystemTime(T0 + 6 * HOUR_MS);
      const live: Added[] = [];
      trackListeners(live, window, 'window');
      trackListeners(live, document, 'document');
      const chartsBefore = liveCharts();
      const containersBefore = containers();

      const screen = await render(chart());
      expect(nowLineX()).toHaveLength(1);
      expect(liveCharts()).toBe(chartsBefore + 1);
      expect(containers()).toBe(containersBefore + 1);
      expect(live.length).toBeGreaterThan(0);
      expect(vi.getTimerCount()).toBeGreaterThan(0);

      vi.advanceTimersByTime(HOUR_MS);
      await screen.unmount();

      expect(liveCharts()).toBe(chartsBefore);
      expect(containers()).toBe(containersBefore);
      expect(vi.getTimerCount()).toBe(0);
      expect(live.map((entry) => `${entry.target}:${entry.type}`)).toStrictEqual([]);
    });
  });
});
