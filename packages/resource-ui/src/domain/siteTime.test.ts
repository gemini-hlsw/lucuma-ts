import { describe, expect, it } from 'vitest';

import { firstEveningDate, lastEveningDate, nightCount, observingNightInterval, observingNightOf } from './siteTime';

const ms = (iso: string): number => Date.parse(iso);

describe('observingNightInterval', () => {
  it('spans 14:00 -> 14:00 local at Gemini North (UTC-10, no DST)', () => {
    expect(observingNightInterval('GN', '2026-08-12')).toEqual({
      start: ms('2026-08-12T00:00:00Z'),
      end: ms('2026-08-13T00:00:00Z'),
    });
  });

  it('spans 14:00 -> 14:00 local at Gemini South in winter (UTC-4)', () => {
    expect(observingNightInterval('GS', '2026-08-12')).toEqual({
      start: ms('2026-08-11T18:00:00Z'),
      end: ms('2026-08-12T18:00:00Z'),
    });
  });

  it('honours Gemini South summer DST (UTC-3)', () => {
    expect(observingNightInterval('GS', '2026-01-15')).toEqual({
      start: ms('2026-01-14T17:00:00Z'),
      end: ms('2026-01-15T17:00:00Z'),
    });
  });
});

/**
 * The "tonight" resolver: a URL with no night means the night this instant
 * belongs to, so the 14:00 rollover is the app's front door.
 */
describe('observingNightOf', () => {
  it('rolls the label over at exactly 14:00 local', () => {
    // Gemini North is UTC-10, so 14:00 local on the 12th is 00:00Z on the 13th.
    expect(observingNightOf('GN', ms('2026-08-12T23:59:59Z'))).toBe('2026-08-12');
    expect(observingNightOf('GN', ms('2026-08-13T00:00:00Z'))).toBe('2026-08-13');
  });

  it('labels every instant of a night with that night, up to its exclusive end', () => {
    const interval = observingNightInterval('GS', '2026-11-14');

    expect(observingNightOf('GS', interval.start)).toBe('2026-11-14');
    expect(observingNightOf('GS', interval.end - 1)).toBe('2026-11-14');
    expect(observingNightOf('GS', interval.end)).toBe('2026-11-15');
  });

  it('holds across the Gemini South spring-forward, where the night is 23 hours', () => {
    // Chile springs forward inside the night labelled 2026-09-06, so a fixed
    // offset would misfile one of its ends.
    const short = observingNightInterval('GS', '2026-09-06');

    expect(short.end - short.start).toBe(23 * 3_600_000);
    expect(observingNightOf('GS', short.start)).toBe('2026-09-06');
    expect(observingNightOf('GS', short.end - 1)).toBe('2026-09-06');
  });
});

/**
 * How a run's extent is named. Both ends are the evening the night begins, which
 * is what the published sheet heads its columns with - so the two must be derived
 * the same way, and neither by arithmetic on the exclusive end instant.
 */
describe('naming the evenings an interval covers', () => {
  const spanning = (site: 'GN' | 'GS', first: string, last: string) => ({
    start: observingNightInterval(site, first).start,
    end: observingNightInterval(site, last).end,
  });

  it('names the first evening as the night before the first label', () => {
    expect(firstEveningDate('GS', spanning('GS', '2026-08-08', '2026-08-14'))).toBe('2026-08-07');
  });

  it('names the last evening as the night before the last label, not the label', () => {
    // The regression: the end instant sits at 14:00 on 2026-08-14, so reading the
    // calendar date an hour earlier gives 2026-08-14 - the label, a day late. The
    // sheet heads that column 13.
    expect(lastEveningDate('GS', spanning('GS', '2026-08-08', '2026-08-14'))).toBe('2026-08-13');
  });

  it('names a single night the same at both ends', () => {
    const one = spanning('GS', '2026-08-08', '2026-08-08');
    expect(firstEveningDate('GS', one)).toBe('2026-08-07');
    expect(lastEveningDate('GS', one)).toBe('2026-08-07');
  });

  it('is exact across a Gemini South DST change, where a night is 23 or 25 hours', () => {
    // Chile springs forward in September, so any fixed hour offset is wrong on one
    // side of this span. Resolving the night first is not.
    const across = spanning('GS', '2026-09-05', '2026-09-08');
    expect(firstEveningDate('GS', across)).toBe('2026-09-04');
    expect(lastEveningDate('GS', across)).toBe('2026-09-07');
  });

  it('holds at Gemini North, which has no DST at all', () => {
    const span = spanning('GN', '2026-08-08', '2026-08-14');
    expect(firstEveningDate('GN', span)).toBe('2026-08-07');
    expect(lastEveningDate('GN', span)).toBe('2026-08-13');
  });
});

/**
 * The finders print this beside every span, so a run list can be read for its
 * lengths. Counted over evening dates for the same reason the evenings are
 * resolved rather than arithmetic'd: a night is not a fixed number of hours.
 */
describe('counting the nights an interval covers', () => {
  const spanning = (site: 'GN' | 'GS', first: string, last: string) => ({
    start: observingNightInterval(site, first).start,
    end: observingNightInterval(site, last).end,
  });

  it('counts one night as one, not zero', () => {
    expect(nightCount('GS', spanning('GS', '2026-08-08', '2026-08-08'))).toBe(1);
  });

  it('counts both ends in', () => {
    expect(nightCount('GS', spanning('GS', '2026-08-08', '2026-08-14'))).toBe(7);
  });

  it('is exact across a Gemini South DST change, where dividing by 24 hours is not', () => {
    // Four nights, one of them 23 hours: the elapsed span is 95 hours, which
    // floors to 3 and rounds to 4 only by luck. Evening dates just count.
    expect(nightCount('GS', spanning('GS', '2026-09-05', '2026-09-08'))).toBe(4);
  });

  it('holds at Gemini North', () => {
    expect(nightCount('GN', spanning('GN', '2026-08-08', '2026-08-14'))).toBe(7);
  });
});
