import type { XAxisOptions } from 'highcharts';
import { describe, expect, it } from 'vitest';

import { buildWeekTimeline } from '@/domain/weekTimeline';

import {
  buildWeekBands,
  buildWeekChartOptions,
  buildWeekLines,
  nightLabel,
  weekTickPositions,
} from './weekChartOptions';

const FIRST = '2026-11-14';

const build = (nightsWithData?: ReadonlySet<string>) =>
  buildWeekTimeline({
    site: 'GS',
    firstNight: FIRST,
    mountings: [],
    closures: [],
    nightsWithData,
  });

const axisOf = (): XAxisOptions => {
  const { xAxis } = buildWeekChartOptions({ week: build(), site: 'GS', now: null });
  if (xAxis === undefined || Array.isArray(xAxis)) {
    throw new Error('expected a single x axis');
  }
  return xAxis;
};

describe('night headings', () => {
  it('heads a night by the weekday and day it begins on', () => {
    const week = build();

    // The night labelled 2026-11-14 begins on Friday the 13th, the sheet's column heading.
    expect(nightLabel(week.nights[0]!, 'GS')).toBe('Fri 13');
    expect(nightLabel(week.nights.at(-1)!, 'GS')).toBe('Thu 19');
  });

  it('puts a tick at the middle of each night, not on a boundary', () => {
    const week = build();
    const ticks = weekTickPositions(week);

    expect(ticks).toHaveLength(7);
    expect(ticks[0]).toBe((week.nights[0]!.interval.start + week.nights[0]!.interval.end) / 2);
  });

  it('draws a line at every night boundary, so the seven are countable', () => {
    expect(buildWeekLines(build())).toHaveLength(7);
  });
});

describe('the sun across the week', () => {
  it('washes every night, so the usable hours read as seven separate windows', () => {
    const bands = buildWeekBands(build(), 'GS');
    const daylight = bands.filter((band) => band.className === 'night-daylight');

    // Two daylight stretches per night - before sunset and after sunrise.
    expect(daylight).toHaveLength(14);
    for (const band of daylight) {
      expect(band.zIndex).toBe(5);
    }
  });
});

describe('nights with nothing recorded', () => {
  it('hatches an un-entered night and names it', () => {
    const bands = buildWeekBands(build(new Set(['2026-11-14'])), 'GS');
    const missing = bands.filter((band) => band.className === 'week-no-data');

    expect(missing).toHaveLength(6);
    expect(missing[0]?.label?.text).toBe('not recorded');
  });

  it('hatches nothing while the answer is still in flight', () => {
    const bands = buildWeekBands(build(undefined), 'GS');

    expect(bands.filter((band) => band.className === 'week-no-data')).toEqual([]);
  });
});

describe('the chart', () => {
  it('spans the whole week continuously', () => {
    const week = build();

    expect(axisOf().min).toBe(week.interval.start);
    expect(axisOf().max).toBe(week.interval.end);
  });
});
