/**
 * The night chart's axis.
 *
 * Tested through the builder rather than a rendered chart, which keeps the sun
 * shading, the clock labels and the tooltip phrasing checkable without a browser.
 */
import type { AxisLabelsFormatterContextObject, XAxisOptions, XAxisPlotLinesOptions, YAxisOptions } from 'highcharts';
import { describe, expect, it } from 'vitest';

import { buildNightTimeline } from '@/domain/nightTimeline';
import { portRowLabel, TELESCOPE_PORTS } from '@/domain/ports';
import { observingNightInterval } from '@/domain/siteTime';
import type { Closure, Mounting } from '@/domain/types';
import { buildTimelinePoints, type TimelinePoint } from '@/features/timeline/timelineOptions';

import {
  buildNightChartOptions,
  buildSunBands,
  buildTransitionLines,
  clockLabel,
  durationLabel,
  nightDescriber,
  ROW_HEIGHT,
} from './nightChartOptions';

const NIGHT = '2026-11-14';
const interval = observingNightInterval('GS', NIGHT);
/** Every night draws the telescope's ports, whatever tonight happens to hold. */
const ROWS = TELESCOPE_PORTS.map(portRowLabel);
const HOUR = 3_600_000;

const mounting = (over: Partial<Mounting> & Pick<Mounting, 'id' | 'port' | 'interval'>): Mounting => ({
  instrument: 'GMOS',
  publishedName: 'GMOS',
  usage: 'SCIENCE',
  place: null,
  note: null,
  ...over,
});

const build = (mountings: readonly Mounting[] = []) =>
  buildNightTimeline({ site: 'GS', observingNight: NIGHT, mountings, closures: [] });

describe('clock and duration labels', () => {
  it('reads the clock in the site zone, not the browser one', () => {
    // The night opens at 14:00 at Cerro Pachon whatever the reader's zone.
    expect(clockLabel(interval.start, 'GS', 'site')).toBe('14:00');
    expect(clockLabel(interval.end, 'GS', 'site')).toBe('14:00');
  });

  it('reads the clock in UT when the masthead says so', () => {
    // Chile runs UTC-3 in November, so the 14:00 boundary prints as 17:00.
    expect(clockLabel(interval.start, 'GS', 'utc')).toBe('17:00');
    expect(clockLabel(interval.end, 'GS', 'utc')).toBe('17:00');
  });

  it('is not a fixed offset from the site clock: DST shifts mid-night', () => {
    // Chile springs forward inside the night labelled 2026-09-06, so the same
    // night opens at UTC-4 and closes at UTC-3 - 18:00 UT in, 17:00 UT out,
    // while the site clock reads 14:00 at both ends.
    const dst = observingNightInterval('GS', '2026-09-06');

    expect(clockLabel(dst.start, 'GS', 'site')).toBe('14:00');
    expect(clockLabel(dst.end, 'GS', 'site')).toBe('14:00');
    expect(clockLabel(dst.start, 'GS', 'utc')).toBe('18:00');
    expect(clockLabel(dst.end, 'GS', 'utc')).toBe('17:00');
  });

  it('phrases a duration in hours and minutes', () => {
    expect(durationLabel(2 * HOUR)).toBe('2 h');
    expect(durationLabel(2 * HOUR + 15 * 60_000)).toBe('2 h 15 m');
    expect(durationLabel(45 * 60_000)).toBe('45 m');
  });
});

describe('describing a block', () => {
  const describe_ = nightDescriber('GS', interval, 'site');

  it('says "all night" rather than a span, when nothing changes', () => {
    const block = build([mounting({ id: 'a', port: 3, interval })]).rows[2]?.blocks[0];

    // A night is 23 or 25 hours either side of a DST change, so a duration here
    // would be both noisy and beside the point.
    expect(describe_.range(block!)).toBe('all night');
  });

  it('gives clock times for a block that covers only part of the night', () => {
    const partial = build([
      mounting({
        id: 'a',
        port: 3,
        interval: { start: interval.start + 6 * HOUR, end: interval.start + 9 * HOUR },
      }),
    ]).rows[2]?.blocks[0];

    expect(describe_.range(partial!)).toBe('20:00 to 23:00');
    expect(describe_.length(partial!)).toBe('3 h');
  });

  it('phrases the same block in UT under the masthead UTC clock', () => {
    const partial = build([
      mounting({
        id: 'a',
        port: 3,
        interval: { start: interval.start + 6 * HOUR, end: interval.start + 9 * HOUR },
      }),
    ]).rows[2]?.blocks[0];

    expect(nightDescriber('GS', interval, 'utc').range(partial!)).toBe('23:00 to 02:00');
  });
});

describe('the sun wash', () => {
  it('paints over the bars, not behind them', () => {
    const bands = buildSunBands(interval, build().sun);

    // An instrument mounted at noon is still mounted, so its bar covers the
    // whole night; a band behind it would be invisible. zIndex above the series
    // is what makes the daylight hours read as unusable.
    expect(bands.length).toBeGreaterThan(0);
    for (const band of bands) {
      expect(band.zIndex).toBe(5);
    }
  });

  it('washes daylight harder than twilight', () => {
    const bands = buildSunBands(interval, build().sun);
    const daylight = bands.filter((band) => band.className === 'night-daylight');
    const twilight = bands.filter((band) => band.className === 'night-twilight');

    expect(daylight).toHaveLength(2);
    expect(twilight).toHaveLength(2);
    expect(daylight[0]?.color).toBe('var(--night-daylight-wash)');
    expect(twilight[0]?.color).toBe('var(--night-twilight-wash)');
  });

  it('leaves the dark hours unwashed', () => {
    const { sun } = build();
    const bands = buildSunBands(interval, sun);
    const covered = bands.some(
      (band) =>
        Number(band.from) <= (sun.duskAstronomical ?? 0) + HOUR && Number(band.to) >= (sun.dawnAstronomical ?? 0),
    );

    expect(covered).toBe(false);
  });
});

/** The chart's single x axis; the builder never produces the array form. */
const axisOf = (now: number | null = null): XAxisOptions => {
  const { xAxis } = buildNightChartOptions({ night: build(), site: 'GS', now, timeDisplay: 'site' });
  if (xAxis === undefined || Array.isArray(xAxis)) {
    throw new Error('expected a single x axis');
  }
  return xAxis;
};

const plotLines = (now: number | null = null): XAxisPlotLinesOptions[] => axisOf(now).plotLines ?? [];

describe('the chart', () => {
  it('spans exactly the night', () => {
    expect(axisOf().min).toBe(interval.start);
    expect(axisOf().max).toBe(interval.end);
  });

  it('hands the masthead clock to Highcharts, which formats the axis labels', () => {
    const optionsIn = (timeDisplay: 'site' | 'utc') =>
      buildNightChartOptions({ night: build(), site: 'GS', now: null, timeDisplay });

    expect(optionsIn('site').time?.timezone).toBe('America/Santiago');
    expect(optionsIn('utc').time?.timezone).toBe('UTC');
  });

  it('marks every instant a row changes', () => {
    const changeover = interval.start + 9 * HOUR;
    const lines = buildTransitionLines([changeover]);

    expect(lines).toEqual([
      { value: changeover, color: 'var(--schedule-week-line)', width: 1, zIndex: 2, className: 'night-transition' },
    ]);
  });

  it('prints sunset and sunrise upright', () => {
    const sunLines = plotLines().filter((line) => line.className === 'night-sun-line');

    // Highcharts rotates a plot-line label 90 degrees by default, which put
    // "sunset" on its side in a 2px column.
    expect(sunLines).toHaveLength(2);
    for (const line of sunLines) {
      expect(line.label?.rotation).toBe(0);
    }
  });

  it('marks now only when it falls inside the night', () => {
    const marker = (now: number | null) => plotLines(now).filter((line) => line.className === 'schedule-today');

    expect(marker(interval.start + HOUR)).toHaveLength(1);
    expect(marker(interval.end + HOUR)).toHaveLength(0);
  });
});

describe('the telescope-state header band', () => {
  // A visitor night with both state rows recorded, over one mounted port.
  const stateNight = buildNightTimeline({
    site: 'GS',
    observingNight: NIGHT,
    mountings: [mounting({ id: 'g1', port: 2, interval })],
    closures: [],
    modeBlocks: [{ id: 'm1', mode: 'PRIORITY_VISITOR', programReferences: [], partner: null, interval, note: null }],
    tooBlocks: [{ id: 't1', tooSupport: 'STANDARD', interval, note: null }],
  });
  const options = buildNightChartOptions({
    night: stateNight,
    site: 'GS',
    now: null,
    timeDisplay: 'site',
  });
  const yAxis = options.yAxis as YAxisOptions;
  const data = (options.series?.[0] as { data: TimelinePoint[] }).data;

  it('names each group above its bars, at full bar size', () => {
    // A heading row over the state rows and one over the subjects (Dan,
    // 2026-08-11) - the "Instruments" heading doubles as the band's breathing
    // room, and the state bars keep the instrument size. (Not an axis break:
    // a break inflates the adjacent category's slot and drops its gutter
    // label out of line with its bar.)
    expect(yAxis.categories).toEqual(['Telescope', 'Mode', 'ToO', 'Instruments', ...ROWS]);
    // Data rows sit past their headings; nothing is ever drawn on a heading.
    // The fixture's one mounting is on Port 2 - category index 5 here.
    expect(data.some((bar) => bar.y === 0 || bar.y === 3)).toBe(false);
    expect(data.some((bar) => bar.y === 5)).toBe(true);
    // The heading rows are real height, not squeezed out of the rows.
    expect(options.chart?.height).toBe(8 + 34 + (2 + 2 + ROWS.length) * ROW_HEIGHT);
  });

  it('draws the state rows monochrome - bright only when the state is notable', () => {
    const fillOf = (label: string) => data.find((point) => point.custom.label === label)?.color;

    // A visitor run is worth noticing; standard ToO support is the ordinary
    // state and stays quiet. Neither spends a hue - hue means instrument.
    expect(fillOf('Priority visitor')).toBe('var(--state-notable)');
    expect(fillOf('Standard ToOs')).toBe('var(--state-routine)');
  });

  it('styles only the headings; every data row keeps its full-strength label', () => {
    const formatter = yAxis.labels?.formatter;
    const printed = (pos: number, value: string) =>
      formatter?.call({ pos, value } as AxisLabelsFormatterContextObject, {} as never) ?? '';

    expect(printed(0, 'Telescope')).toContain('TELESCOPE');
    expect(printed(0, 'Telescope')).toContain('var(--timeline-muted-text)');
    expect(printed(1, 'Mode')).toBe('Mode');
    expect(printed(4, 'Port 1-up')).toBe('Port 1-up');
  });
});

describe('instrument usability treatments', () => {
  const pointFor = (usage: Mounting['usage']) => {
    const night = buildNightTimeline({
      site: 'GS',
      observingNight: NIGHT,
      mountings: [mounting({ id: 'a', port: 3, usage, interval })],
      closures: [],
    });
    return buildTimelinePoints(night.rows, nightDescriber('GS', interval, 'site'))[0];
  };

  it('hatches an engineering-use block in its own hue and measured ink', () => {
    const point = pointFor('ENGINEERING');

    // Identity stays on the hue; the stripes say "reserved". The ink stripes
    // are the same pair measured for the labels, so they separate everywhere.
    expect(point?.color).toMatchObject({
      pattern: { backgroundColor: 'var(--instrument-gmos)', color: 'var(--instrument-ink-dark)' },
    });
    expect(point?.custom.usageLabel).toBe('Engineering use');
  });

  it('hollows a not-available block, keeping its hue on the outline', () => {
    const point = pointFor('UNAVAILABLE');

    expect(point?.color).toBe('transparent');
    expect(point?.borderColor).toBe('var(--instrument-gmos)');
    expect(point?.dataLabels).toEqual({ style: { color: 'var(--timeline-muted-text)' } });
    expect(point?.custom.usageLabel).toBe('Not available');
  });

  it('says nothing about ordinary science use - the default earns no ink', () => {
    expect(pointFor('SCIENCE')?.custom.usageLabel).toBeNull();
  });
});

describe('a port closure on the night', () => {
  const closure = (over: Partial<Closure> & Pick<Closure, 'id' | 'interval'>): Closure => ({
    availability: 'CLOSED',
    port: 3,
    reason: null,
    ...over,
  });

  const pointsFor = (closures: readonly Closure[]) => {
    const night = buildNightTimeline({ site: 'GS', observingNight: NIGHT, mountings: [], closures });
    return buildTimelinePoints(night.rows, nightDescriber('GS', interval, 'site'));
  };

  it('draws as the hollow absence every view gives it - the Telescope row owns the red', () => {
    // The consistent shutdown treatment (Dan, 2026-08-11): a port-scoped span
    // is not the telescope closing, and painting it red said otherwise. The
    // reason still rides the block and its tooltip.
    const half = closure({
      id: 'c1',
      reason: 'Baffle inspection',
      interval: { start: interval.start, end: interval.start + 12 * HOUR },
    });
    const point = pointsFor([half])[0];

    expect(point?.className).toBe('schedule-ghost');
    expect(point?.color).toBe('var(--schedule-ghost-fill)');
    expect(point?.custom.label).toBe('Baffle inspection');
  });

  it('names an unreasoned span as the shared absence label', () => {
    const bare = closure({ id: 'c2', interval });

    expect(pointsFor([bare])[0]?.custom.label).toBe('No instrument scheduled');
  });
});
