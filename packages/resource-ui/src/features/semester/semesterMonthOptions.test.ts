/**
 * The month chart's options.
 *
 * Tested through the builder rather than through a rendered chart, which is what
 * keeps the label, colour and tooltip decisions checkable without a browser.
 */
import { describe, expect, it } from 'vitest';

import { portRowLabel, TELESCOPE_PORTS } from '@/domain/ports';
import { buildSemesterTimeline, type TimelineMonth } from '@/domain/semesterTimeline';
import { observingNightInterval } from '@/domain/siteTime';
import type { Closure, Mounting, Site } from '@/domain/types';
import { buildTimelinePoints, eveningDescriber } from '@/features/timeline/timelineOptions';

import {
  buildMonthBands,
  buildSemesterMonthOptions,
  dayTickPositions,
  widthForEveryNight,
} from './semesterMonthOptions';

/** The month's points, built the way buildSemesterMonthOptions builds them. */
const buildMonthPoints = (month: TimelineMonth, site: Site) => buildTimelinePoints(month.rows, eveningDescriber(site));

const night = (label: string) => observingNightInterval('GS', label);
const span = (from: string, to: string) => ({ start: night(from).start, end: night(to).end });

/** Every month draws the telescope's ports, whatever the semester holds. */
const ROWS = TELESCOPE_PORTS.map(portRowLabel);

const GHOST: Mounting = {
  id: 'ghost',
  instrument: 'GHOST',
  publishedName: 'GHOST',
  usage: 'SCIENCE',
  port: 1,
  locationType: 'PORT',
  note: null,
  interval: span('2026-08-08', '2027-02-01'),
};

const AG: Closure = {
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
  mountings: [GHOST],
  closures: [AG],
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

    // The evening dates the sheet would head the first and last columns with.
    //
    // "31 Jan", not "1 Feb". The block's last observing night is labelled 1 Feb,
    // but a night is named by the morning it ends on and the sheet heads its
    // column with the evening it began - so the last column of GS 2026B reads 31.
    // This asserted "1 Feb" until the end was derived through the night rather
    // than by stepping back an hour from the exclusive end instant, which lands
    // on the label date.
    expect(point?.custom.rangeLabel).toBe('7 Aug to 31 Jan');
    expect(point?.custom.lengthLabel).toBe('178 nights');
    expect(point?.custom.clipped).toBe(true);
  });

  it('draws an absence as a hollow block rather than a fourth fill', () => {
    // Every recessive fill tried against the nominal measured below the
    // normal-vision separation floor; fill against no fill needs no hue at all.
    const point = buildMonthPoints(august, 'GS').find((entry) => entry.custom.label === 'A&G');

    expect(point?.className).toBe('schedule-ghost');
    expect(point?.color).toBe('var(--schedule-ghost-fill)');
  });

  it('colours a block by its instrument, with ink that is legible on it', () => {
    const points = buildMonthPoints(august, 'GS');
    const ghost = points.find((entry) => entry.custom.label === 'GHOST');

    expect(ghost?.color).toBe('var(--instrument-ghost)');
    // GHOST's teal is light enough that white manages only 3.67:1 on it, so its
    // blocks take dark ink. Only the three deepest fills take white.
    expect(ghost?.dataLabels).toEqual({ style: { color: 'var(--instrument-ink-dark)' } });
  });

  it('keeps colour tied to the instrument, not to its position in the data', () => {
    // A semester missing an instrument must not repaint the ones that remain.
    const withoutGhost = buildSemesterTimeline({
      site: 'GS',
      firstNight: '2026-08-02',
      lastNight: '2026-09-01',
      mountings: [{ ...GHOST, id: 'gmos', instrument: 'GMOS', publishedName: 'GMOS', port: 3 }],
      closures: [],
    });

    const point = buildMonthPoints(withoutGhost.months[0]!, 'GS')[0];
    expect(point?.color).toBe('var(--instrument-gmos)');
  });

  it('falls back to the state when the sheet named nothing', () => {
    const unnamed = buildSemesterTimeline({
      site: 'GS',
      firstNight: '2026-08-02',
      lastNight: '2026-09-01',
      mountings: [],
      closures: [{ ...AG, reason: null }],
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
    const options = buildSemesterMonthOptions({ month: august, site: 'GS', now: null });
    const rules = options.responsive?.rules ?? [];

    expect(options.xAxis).toMatchObject({ tickPositions: dayTickPositions(august, 1) });
    expect(rules[0]?.condition?.maxWidth).toBe(widthForEveryNight(august.nights.length));
    expect(rules[0]?.chartOptions?.xAxis).toMatchObject({ tickPositions: dayTickPositions(august, 2) });
  });
});

describe('bands', () => {
  it('shades the weekend nights', () => {
    const weekends = buildMonthBands(august).filter((band) => band.className === 'schedule-weekend');

    expect(weekends).toHaveLength(august.nights.filter((entry) => entry.isWeekend).length);
    expect(weekends.length).toBeGreaterThan(0);
  });

  it('washes a telescope-wide closure across every row, labelled once', () => {
    const shut = buildSemesterTimeline({
      site: 'GS',
      firstNight: '2026-08-02',
      lastNight: '2026-09-01',
      mountings: [],
      closures: [
        {
          id: 'wide',
          availability: 'CLOSED',
          port: null,
          reason: 'Telescope Shutdown A&G Maintenance',
          interval: span('2026-08-02', '2026-08-07'),
        },
      ],
    });

    const band = buildMonthBands(shut.months[0]!).find((entry) => entry.className === 'schedule-closure-band');

    expect(band?.label?.text).toBe('Telescope Shutdown A&G Maintenance');
  });
});

describe('axis', () => {
  it('reads day numbers in the site clock, not the browser one', () => {
    const options = buildSemesterMonthOptions({ month: august, site: 'GS', now: null });

    // A night at Gemini South spans two UTC dates; the viewer's zone would shift
    // every column.
    expect(options.time).toEqual({ timezone: 'America/Santiago' });
  });

  it('pins the rows so a row with nothing on it keeps its height', () => {
    const options = buildSemesterMonthOptions({ month: august, site: 'GS', now: null });

    expect(options.yAxis).toMatchObject({ min: 0, max: ROWS.length - 1, categories: ROWS });
  });

  it('marks now only in the month it falls in', () => {
    const inside = buildSemesterMonthOptions({
      month: august,
      site: 'GS',
      now: august.interval.start + 60_000,
    });
    const outside = buildSemesterMonthOptions({
      month: august,
      site: 'GS',
      now: august.interval.end + 86_400_000,
    });

    const marker = (options: ReturnType<typeof buildSemesterMonthOptions>) =>
      (Array.isArray(options.xAxis) ? undefined : options.xAxis?.plotLines)?.filter(
        (line) => line.className === 'schedule-today',
      );

    expect(marker(inside)).toHaveLength(1);
    expect(marker(outside)).toHaveLength(0);
  });
});
