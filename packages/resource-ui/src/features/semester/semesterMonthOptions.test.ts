/** Through the builder, so label, colour and tooltip decisions are checkable without a browser. */
import type { AxisLabelsFormatterContextObject } from 'highcharts';
import { describe, expect, it } from 'vitest';

import { portRowLabel, TELESCOPE_PORTS } from '@/domain/ports';
import { buildSemesterTimeline, type TimelineMonth } from '@/domain/semesterTimeline';
import { observingNightInterval } from '@/domain/siteTime';
import type { InstrumentAvailabilityBlock, Site, TelescopeAvailabilityBlock } from '@/domain/types';
import { buildTimelinePoints, DENSE, eveningDescriber, TICK } from '@/features/timeline/timelineOptions';
import { scheduleOf } from '@/test/fixtures/domain';
import { collectFontSizes } from '@/test/fontSizes';

import {
  buildMonthBands,
  buildSemesterMonthOptions,
  dayTickPositions,
  widthForEveryNight,
} from './semesterMonthOptions';

const buildMonthPoints = (month: TimelineMonth, site: Site) => buildTimelinePoints(month.rows, eveningDescriber(site));

const night = (label: string) => observingNightInterval('GS', label);
const span = (from: string, to: string) => ({ start: night(from).start, end: night(to).end });

/** Every month draws the telescope's ports, whatever the semester holds. */
const ROWS = TELESCOPE_PORTS.map(portRowLabel);

const GHOST: InstrumentAvailabilityBlock = {
  id: 'ghost',
  instrument: 'GHOST',
  publishedName: 'GHOST',
  usage: 'SCIENCE',
  port: 1,
  place: null,
  note: null,
  interval: span('2026-08-08', '2027-02-01'),
};

const AG: TelescopeAvailabilityBlock = {
  id: 'ag',
  availability: 'CLOSED',
  port: 4,
  reason: 'A&G',
  interval: span('2026-08-02', '2027-02-01'),
};

const timeline = buildSemesterTimeline({
  site: 'GS',
  firstNight: '2026-08-02',
  lastNight: '2027-02-01',
  schedule: scheduleOf({ instrumentAvailability: [GHOST], telescopeAvailability: [AG] }),
});

const august = timeline.months[0]!;

describe('points', () => {
  it('places a block on its row, over its own interval', () => {
    const point = buildMonthPoints(august, 'GS').find((entry) => entry.custom.label === 'GHOST');

    expect(point?.y).toBe(0);
    expect(point?.x).toBe(GHOST.interval.start);
  });

  it('names the published span and its length in nights, for the tooltip', () => {
    const point = buildMonthPoints(august, 'GS').find((entry) => entry.custom.label === 'GHOST');

    // "31 Jan", not "1 Feb": the end has to be derived through the night, not the exclusive instant.
    expect(point?.custom.rangeLabel).toBe('7 Aug to 31 Jan');
    expect(point?.custom.lengthLabel).toBe('178 nights');
    expect(point?.custom.clipped).toBe(true);
  });

  it('draws an absence as a hollow block rather than a fourth fill', () => {
    const point = buildMonthPoints(august, 'GS').find((entry) => entry.custom.label === 'A&G');

    expect(point?.className).toBe('schedule-ghost');
    expect(point?.color).toBe('var(--schedule-ghost-fill)');
  });

  it('colours a block by its instrument, with ink that is legible on it', () => {
    const points = buildMonthPoints(august, 'GS');
    const ghost = points.find((entry) => entry.custom.label === 'GHOST');

    expect(ghost?.color).toBe('var(--instrument-ghost)');
    expect(ghost?.dataLabels).toEqual({ style: { color: 'var(--instrument-ink-dark)' } });
  });

  it('keeps colour tied to the instrument, not to its position in the data', () => {
    const withoutGhost = buildSemesterTimeline({
      site: 'GS',
      firstNight: '2026-08-02',
      lastNight: '2026-09-01',
      schedule: scheduleOf({
        instrumentAvailability: [{ ...GHOST, id: 'gmos', instrument: 'GMOS', publishedName: 'GMOS', port: 3 }],
      }),
    });

    const point = buildMonthPoints(withoutGhost.months[0]!, 'GS')[0];
    expect(point?.color).toBe('var(--instrument-gmos)');
  });

  it('falls back to the state when the sheet named nothing', () => {
    const unnamed = buildSemesterTimeline({
      site: 'GS',
      firstNight: '2026-08-02',
      lastNight: '2026-09-01',
      schedule: scheduleOf({ telescopeAvailability: [{ ...AG, reason: null }] }),
    });

    const point = buildMonthPoints(unnamed.months[0]!, 'GS')[0];
    expect(point?.custom.label).toBe('No instrument scheduled');
  });
});

describe('day numbers', () => {
  it('puts a tick at the middle of the night it names, not on a boundary', () => {
    const first = august.nights[0];
    const positions = dayTickPositions(august, 1);

    // A boundary tick would sit at the edge of two nights and read as the wrong one.
    expect(positions[0]).toBe(((first?.interval.start ?? 0) + (first?.interval.end ?? 0)) / 2);
    expect(positions).toHaveLength(august.nights.length);
  });

  it('thins evenly and always keeps the first night', () => {
    const every = dayTickPositions(august, 1);
    const other = dayTickPositions(august, 2);

    expect(other[0]).toBe(every[0]);
    expect(other[1]).toBe(every[2]);
    expect(other).toHaveLength(Math.ceil(august.nights.length / 2));
  });

  it('asks for more room the more nights a month has', () => {
    expect(widthForEveryNight(31)).toBeGreaterThan(widthForEveryNight(28));
  });

  it('numbers every night when wide, and thins as the container narrows', () => {
    const options = buildSemesterMonthOptions({ month: august, site: 'GS' });
    const rules = options.responsive?.rules ?? [];

    expect(options.xAxis).toMatchObject({ tickPositions: dayTickPositions(august, 1) });
    expect(rules[0]?.condition?.maxWidth).toBe(widthForEveryNight(august.nights.length));
    expect(rules[0]?.chartOptions?.xAxis).toMatchObject({ tickPositions: dayTickPositions(august, 2) });
  });
});

describe('the axis', () => {
  const axisOf = () => {
    const { xAxis } = buildSemesterMonthOptions({ month: august, site: 'GS' });
    if (xAxis === undefined || Array.isArray(xAxis)) {
      throw new Error('expected a single x axis');
    }
    return xAxis;
  };

  it("numbers the tick in the middle of each night with its evening's day, and any other value with nothing", () => {
    const formatter = axisOf().labels?.formatter;
    const label = (value: number) =>
      formatter?.call({ value } as AxisLabelsFormatterContextObject, {} as never) ?? 'no formatter';
    const labels = dayTickPositions(august, 1).map(label);

    expect(labels.slice(0, 3)).toEqual(['1', '2', '3']);
    expect(labels.at(-1)).toBe('31');
    expect(label(august.interval.start)).toBe('');
  });

  it('draws a line at the start of every night, in the week colour where a Sunday evening begins one', () => {
    const lines = (axisOf().plotLines ?? []).filter((line) => line.className !== 'schedule-today');
    const weekStarts = lines.filter((line) => line.color === 'var(--schedule-week-line)');

    expect(lines.map((line) => line.value)).toEqual(august.nights.map((entry) => entry.interval.start));
    expect(weekStarts.map((line) => line.value)).toEqual(
      ['2026-08-03', '2026-08-10', '2026-08-17', '2026-08-24', '2026-08-31'].map((label) => night(label).start),
    );
  });

  it('reads day numbers in the site clock, not the browser one', () => {
    const options = buildSemesterMonthOptions({ month: august, site: 'GS' });

    // A GS night spans two UTC dates; the viewer's zone would shift every column.
    expect(options.time).toEqual({ timezone: 'America/Santiago' });
  });

  it('pins the rows so a row with nothing on it keeps its height', () => {
    const options = buildSemesterMonthOptions({ month: august, site: 'GS' });

    expect(options.yAxis).toMatchObject({ min: 0, max: ROWS.length - 1, categories: ROWS });
  });

  it('sets every chart label at Data-small but the day ticks, whatever the month width', () => {
    const options = buildSemesterMonthOptions({ month: august, site: 'GS' });

    // The walk reaches the responsive rules too: a narrow month thins its ticks, never its labels.
    expect(new Set(collectFontSizes(options))).toEqual(new Set([DENSE, TICK]));
  });
});

describe('the weekend bands', () => {
  it('shades the weekend nights', () => {
    const weekends = buildMonthBands(august).filter((band) => band.className === 'schedule-weekend');

    expect(weekends).toHaveLength(august.nights.filter((entry) => entry.isWeekend).length);
    expect(weekends.length).toBeGreaterThan(0);
  });
});

describe('the telescope-wide closure band', () => {
  const shutdown: TelescopeAvailabilityBlock = {
    id: 'wide',
    availability: 'CLOSED',
    port: null,
    reason: 'Telescope Shutdown A&G Maintenance',
    interval: span('2026-08-03', '2026-08-06'),
  };
  const month = buildSemesterTimeline({
    site: 'GS',
    firstNight: '2026-08-02',
    lastNight: '2027-02-01',
    schedule: scheduleOf({ telescopeAvailability: [shutdown] }),
  }).months[0]!;

  const closureBand = () => buildMonthBands(month).find((band) => band.className === 'schedule-closure-band');

  it('is labelled once, with the closure reason', () => {
    expect(closureBand()?.label?.text).toBe(shutdown.reason);
  });

  it('spans only the nights it closes, not the month', () => {
    expect(closureBand()?.from).toBe(shutdown.interval.start);
    expect(closureBand()?.to).toBe(shutdown.interval.end);
  });

  it('hangs its label at the height the month chart leaves for it', () => {
    // The month's rows are shorter than the night and week rows, so its heading row sits higher.
    expect(closureBand()?.label?.y).toBe(12);
  });
});
