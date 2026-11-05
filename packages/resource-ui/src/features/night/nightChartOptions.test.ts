import type { XAxisOptions, YAxisOptions } from 'highcharts';
import { describe, expect, it } from 'vitest';

import { buildNightTimeline } from '@/domain/nightTimeline';
import { DAY_MS, HOUR_MS, observingNightInterval } from '@/domain/siteTime';
import { TOO_SUPPORT_LABEL } from '@/domain/timeline';
import type { InstrumentAvailabilityBlock, Schedule, TelescopeAvailabilityBlock } from '@/domain/types';
import { buildTimelinePoints, DENSE, readerPx, TICK, type TimelinePoint } from '@/features/timeline/timelineOptions';
import { axisLabel, singleXAxis } from '@/test/chartOptions';
import {
  domainInstrumentBlock,
  domainTelescopeClosure,
  domainTelescopeModeBlock,
  domainTooSupportBlock,
  PORT_ROW_LABELS,
  scheduleOf,
} from '@/test/fixtures/domain';
import { collectFontSizes } from '@/test/fontSizes';

import {
  buildNightChartOptions,
  buildTransitionLines,
  clockLabel,
  durationLabel,
  nightDescriber,
  ROW_HEIGHT_REM,
} from './nightChartOptions';

const NIGHT = '2026-11-14';
const interval = observingNightInterval('GS', NIGHT);

const build = (schedule: Partial<Schedule> = {}) =>
  buildNightTimeline({ site: 'GS', observingNight: NIGHT, schedule: scheduleOf(schedule) });

const onPort3 = (over: Partial<InstrumentAvailabilityBlock> = {}): InstrumentAvailabilityBlock =>
  domainInstrumentBlock({ id: 'a', port: 3, interval, ...over });

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
    // Chile springs forward inside the night labelled 2026-09-06: 18:00 UT in, 17:00 UT out.
    const dst = observingNightInterval('GS', '2026-09-06');

    expect(clockLabel(dst.start, 'GS', 'site')).toBe('14:00');
    expect(clockLabel(dst.end, 'GS', 'site')).toBe('14:00');
    expect(clockLabel(dst.start, 'GS', 'utc')).toBe('18:00');
    expect(clockLabel(dst.end, 'GS', 'utc')).toBe('17:00');
  });

  it('phrases a duration in hours and minutes', () => {
    expect(durationLabel(2 * HOUR_MS)).toBe('2 h');
    expect(durationLabel(2 * HOUR_MS + 15 * 60_000)).toBe('2 h 15 m');
    expect(durationLabel(45 * 60_000)).toBe('45 m');
  });
});

describe('describing a block', () => {
  const describe_ = nightDescriber('GS', interval, 'site');

  it('says "all night" rather than a span, when nothing changes', () => {
    const block = build({ instrumentAvailability: [onPort3()] }).rows[2]?.blocks[0];

    // A night is 23 or 25 hours either side of a DST change, so a duration would be noise.
    expect(describe_.range(block!)).toBe('all night');
  });

  it('gives clock times for a block that covers only part of the night', () => {
    const partial = build({
      instrumentAvailability: [
        onPort3({ interval: { start: interval.start + 6 * HOUR_MS, end: interval.start + 9 * HOUR_MS } }),
      ],
    }).rows[2]?.blocks[0];

    expect(describe_.range(partial!)).toBe('20:00 to 23:00');
    expect(describe_.length(partial!)).toBe('3 h');
  });

  it('phrases the same block in UT under the masthead UTC clock', () => {
    const partial = build({
      instrumentAvailability: [
        onPort3({ interval: { start: interval.start + 6 * HOUR_MS, end: interval.start + 9 * HOUR_MS } }),
      ],
    }).rows[2]?.blocks[0];

    expect(nightDescriber('GS', interval, 'utc').range(partial!)).toBe('23:00 to 02:00');
  });
});

const axisOf = (): XAxisOptions =>
  singleXAxis(buildNightChartOptions({ night: build(), site: 'GS', timeDisplay: 'site' }));

describe('the chart', () => {
  it('spans exactly the night', () => {
    expect(axisOf().min).toBe(interval.start);
    expect(axisOf().max).toBe(interval.end);
  });

  it('hands the masthead clock to Highcharts, which formats the axis labels', () => {
    const optionsIn = (timeDisplay: 'site' | 'utc') =>
      buildNightChartOptions({ night: build(), site: 'GS', timeDisplay });

    expect(optionsIn('site').time?.timezone).toBe('America/Santiago');
    expect(optionsIn('utc').time?.timezone).toBe('UTC');
  });

  it('marks every instant a row changes', () => {
    const changeover = interval.start + 9 * HOUR_MS;
    const lines = buildTransitionLines([changeover]);

    expect(lines).toEqual([
      { value: changeover, color: 'var(--schedule-week-line)', width: 1, zIndex: 2, className: 'night-transition' },
    ]);
  });

  it('sets every chart label at Data-small but the hour ticks, which are the tick tier', () => {
    // A closure band and the now marker's slot, so every label the night chart can set is in the walk.
    const night = build({
      instrumentAvailability: [onPort3()],
      telescopeAvailability: [domainTelescopeClosure({ id: 'wide', reason: 'Shutdown', interval })],
    });
    const options = buildNightChartOptions({ night, site: 'GS', timeDisplay: 'site' });

    expect(new Set(collectFontSizes(options))).toEqual(new Set([DENSE, TICK]));
  });
});

describe('the telescope-state header band', () => {
  const stateNight = build({
    instrumentAvailability: [domainInstrumentBlock({ id: 'g1', port: 2, interval })],
    telescopeMode: [domainTelescopeModeBlock({ id: 'm1', mode: 'PRIORITY_VISITOR', interval })],
    tooSupport: [domainTooSupportBlock({ id: 't1', interval })],
  });
  const options = buildNightChartOptions({ night: stateNight, site: 'GS', timeDisplay: 'site' });
  const yAxis = options.yAxis as YAxisOptions;
  const data = (options.series?.[0] as { data: TimelinePoint[] }).data;

  it('names each group above its bars, at full bar size', () => {
    // A heading row over the state rows and one over the subjects, not an axis break.
    expect(yAxis.categories).toEqual(['Telescope', 'Mode', 'ToO', 'Instruments', ...PORT_ROW_LABELS]);
    // The fixture's one instrument block is on Port 2 - category index 5 here.
    expect(data.some((bar) => bar.y === 0 || bar.y === 3)).toBe(false);
    expect(data.some((bar) => bar.y === 5)).toBe(true);
    // The heading rows are real height, not squeezed out of the rows.
    expect(options.chart?.height).toBe(
      8 + readerPx(2.125) + (2 + 2 + PORT_ROW_LABELS.length) * readerPx(ROW_HEIGHT_REM),
    );
  });

  it('draws the state rows monochrome - bright only when the state is notable', () => {
    const fillOf = (label: string) => data.find((point) => point.custom.label === label)?.color;

    // A visitor run is worth noticing; standard ToO support stays quiet. Neither spends a hue.
    expect(fillOf('Priority visitor')).toBe('var(--state-notable)');
    expect(fillOf(TOO_SUPPORT_LABEL.STANDARD)).toBe('var(--state-routine)');
  });

  it('styles only the headings; every data row keeps its full-strength label', () => {
    const printed = (pos: number, value: string) => axisLabel(yAxis, { value, pos });

    expect(printed(0, 'Telescope')).toContain('TELESCOPE');
    expect(printed(0, 'Telescope')).toContain('var(--timeline-text)');
    expect(printed(1, 'Mode')).toBe('Mode');
    expect(printed(4, 'Port 1-up')).toBe('Port 1-up');
  });

  it('sets a heading at Dense, the one chart size the walk cannot see', () => {
    // A heading's font-size lives inside a formatter-built HTML string, invisible to collectFontSizes'
    // object walk, so this is the one place that has to assert the size directly.
    expect(axisLabel(yAxis, { value: 'Telescope', pos: 0 })).toContain(`font-size: ${DENSE}`);
  });
});

describe('instrument usability treatments', () => {
  const pointFor = (usage: InstrumentAvailabilityBlock['usage']) => {
    const night = build({ instrumentAvailability: [onPort3({ usage })] });
    return buildTimelinePoints(night.rows, nightDescriber('GS', interval, 'site'))[0];
  };

  it('hatches an engineering-use block in its own hue and measured ink', () => {
    const point = pointFor('ENGINEERING');

    // The ink stripes are the same pair measured for the labels, so they separate everywhere.
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
  const pointsFor = (telescopeAvailability: readonly TelescopeAvailabilityBlock[]) =>
    buildTimelinePoints(build({ telescopeAvailability }).rows, nightDescriber('GS', interval, 'site'));

  it('draws as the hollow absence every view gives it - the Telescope row owns the red', () => {
    // A port-scoped span is not the telescope closing, and painting it red says otherwise.
    const half = domainTelescopeClosure({
      id: 'c1',
      port: 3,
      reason: 'Baffle inspection',
      interval: { start: interval.start, end: interval.start + 12 * HOUR_MS },
    });
    const point = pointsFor([half])[0];

    expect(point?.className).toBe('schedule-ghost');
    expect(point?.color).toBe('var(--schedule-ghost-fill)');
    expect(point?.custom.label).toBe('Baffle inspection');
  });

  it('names an unreasoned span as the shared absence label', () => {
    const bare = domainTelescopeClosure({ id: 'c2', port: 3, interval });

    expect(pointsFor([bare])[0]?.custom.label).toBe('No instrument scheduled');
  });
});

describe('a telescope-wide closure on the night', () => {
  const shutdown = domainTelescopeClosure({
    id: 'wide',
    reason: 'Telescope Shutdown A&G Maintenance',
    // Several nights long, as the published shutdowns are: this night sees the middle of it.
    interval: { start: interval.start - 2 * DAY_MS, end: interval.end + 2 * DAY_MS },
  });

  const closureBand = () => {
    const night = build({ telescopeAvailability: [shutdown] });
    const xAxis = singleXAxis(buildNightChartOptions({ night, site: 'GS', timeDisplay: 'site' }));
    return (xAxis.plotBands ?? []).find((band) => band.className === 'schedule-closure-band');
  };

  it('washes the night from edge to edge, clipped to the window', () => {
    expect(closureBand()?.from).toBe(interval.start);
    expect(closureBand()?.to).toBe(interval.end);
  });

  it('hangs its label at the height the night chart leaves for it', () => {
    expect(closureBand()?.label?.y).toBe(14);
  });
});
