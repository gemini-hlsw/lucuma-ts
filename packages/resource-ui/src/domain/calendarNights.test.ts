import { describe, expect, it } from 'vitest';

import { brightnessOf, buildCalendarNights } from './calendarNights';
import { portRowLabel, TELESCOPE_PORTS } from './ports';
import { buildSemesterCells } from './semesterCells';
import { buildSemesterTimeline } from './semesterTimeline';
import { observingNightInterval } from './siteTime';
import type { Closure, MoonEvent, Mounting } from './types';

const SITE = 'GS' as const;

const nights = (first: string, last: string) => ({
  start: observingNightInterval(SITE, first).start,
  end: observingNightInterval(SITE, last).end,
});

const mounting = (over: Partial<Mounting> = {}): Mounting => ({
  id: 'm1',
  instrument: 'GMOS',
  publishedName: 'GMOS',
  usage: 'SCIENCE',
  port: 3,
  place: null,
  interval: nights('2026-08-08', '2026-08-14'),
  note: null,
  ...over,
});

interface BuildOptions {
  readonly mountings?: readonly Mounting[];
  readonly closures?: readonly Closure[];
  readonly holidays?: readonly string[];
  readonly moonEvents?: readonly MoonEvent[];
  readonly firstNight?: string;
  readonly lastNight?: string;
}

const build = ({
  mountings = [mounting()],
  closures = [],
  holidays = [],
  moonEvents = [],
  firstNight = '2026-08-08',
  lastNight = '2026-08-14',
}: BuildOptions = {}) => {
  const timeline = buildSemesterTimeline({
    site: SITE,
    firstNight,
    lastNight,
    mountings,
    closures,
  });
  const monthNights = timeline.months.flatMap((month) => month.nights);
  return buildCalendarNights({
    site: SITE,
    rows: buildSemesterCells({ rows: timeline.rows, nights: monthNights }),
    observingNights: monthNights.map((night) => night.observingNight),
    holidays,
    moonEvents,
    bands: timeline.bands,
  });
};

describe('a night is headed by the evening it begins', () => {
  it('pairs each observing night with the evening the sheet heads it by', () => {
    // The same convention as the grid's day numbers. If these disagree the same
    // run appears to move by a day between two views of one page.
    expect(build()[0]).toMatchObject({ eveningDate: '2026-08-07', observingNight: '2026-08-08' });
  });
});

describe('what only the calendar can say', () => {
  it('carries the moon for the middle of the night, not either boundary', () => {
    const night = build()[0];
    expect(night?.moon.fraction).toBeGreaterThanOrEqual(0);
    expect(night?.moon.fraction).toBeLessThanOrEqual(1);
    expect(night?.brightness).toBe(brightnessOf(night?.moon.fraction ?? 0));
  });

  it('marks the new and full moons the sheet prints, on the evening it prints them', () => {
    const moonEvents: MoonEvent[] = [{ date: '2026-08-09', phase: 'FULL' }];
    const marked = build({ moonEvents }).filter((night) => night.publishedMoon !== null);

    expect(marked).toHaveLength(1);
    expect(marked[0]).toMatchObject({ eveningDate: '2026-08-09', publishedMoon: 'FULL' });
  });

  it('marks a public holiday, which nothing but the sheet knows', () => {
    const marked = build({ holidays: ['2026-08-10'] }).filter((night) => night.isHoliday);

    expect(marked.map((night) => night.eveningDate)).toEqual(['2026-08-10']);
  });

  it('computes weekends rather than importing them, since the calendar is certain', () => {
    // 2026-08-08 is a Saturday and 2026-08-09 a Sunday.
    const byEvening = new Map(build().map((night) => [night.eveningDate, night.isWeekend]));
    expect(byEvening.get('2026-08-08')).toBe(true);
    expect(byEvening.get('2026-08-09')).toBe(true);
    expect(byEvening.get('2026-08-10')).toBe(false);
  });

  it('reports hours of astronomical dark, which shorten across a southern semester', () => {
    const august = build()[0]?.darkHours;
    const december = build({ firstNight: '2026-12-20', lastNight: '2026-12-20', mountings: [] })[0]?.darkHours;

    expect(august).toBeGreaterThan(0);
    // Gemini South in December is near midsummer, so its nights are the shortest.
    expect(december).toBeLessThan(august ?? 0);
  });
});

describe('brightness', () => {
  it('splits dark, grey and bright the way planning does', () => {
    expect(brightnessOf(0.05)).toBe('DARK');
    expect(brightnessOf(0.4)).toBe('GREY');
    expect(brightnessOf(0.95)).toBe('BRIGHT');
  });
});

describe('the complement', () => {
  it('gives one chip per port, in port order', () => {
    expect(build()[0]?.complement.map((chip) => chip.rowLabel)).toEqual(TELESCOPE_PORTS.map(portRowLabel));
  });

  it('names the instrument on the port that has one and leaves the others empty', () => {
    const complement = build()[0]?.complement;

    expect(complement?.[2]).toMatchObject({ rowLabel: 'Port 3', instrument: 'GMOS', kind: 'MOUNTED' });
    expect(complement?.[3]).toMatchObject({ rowLabel: 'Port 4', instrument: null, kind: 'EMPTY' });
  });

  it('says a night is not recorded when no row holds anything, never that it is closed', () => {
    // Invariant I4 reaching the calendar square.
    expect(build({ mountings: [] })[0]?.anyRecorded).toBe(false);
  });
});

describe('changes, which are the reason the calendar is not just the chart wrapped', () => {
  const closure = (over: Partial<Closure> = {}): Closure => ({
    id: 'wide',
    availability: 'CLOSED',
    port: null,
    interval: nights('2026-08-08', '2026-08-10'),
    reason: 'Telescope Shutdown',
    ...over,
  });

  it('marks nothing on the first night, which has nothing to differ from', () => {
    expect(build()[0]?.changes).toEqual([]);
  });

  it('leaves an unchanging run silent, so the marks mean something', () => {
    // Eight nights of one mounting is one fact, and should mark no night at all.
    expect(build().every((night) => night.changes.length === 0)).toBe(true);
  });

  it('marks the night a shutdown begins and the night it ends, once each', () => {
    const marked = build({ mountings: [], closures: [closure()] }).filter((night) => night.changes.length > 0);

    expect(marked.map((night) => [night.eveningDate, night.changes])).toEqual([['2026-08-10', ['Shutdown ends']]]);
  });

  it('states a shutdown once rather than once per port', () => {
    const marked = build({ closures: [closure()] }).filter((night) => night.changes.length > 0);

    for (const night of marked) {
      expect(night.changes).toHaveLength(1);
    }
  });

  it('names the row and the instrument when a mounting changes', () => {
    const marked = build({
      mountings: [
        mounting({ id: 'a', interval: nights('2026-08-08', '2026-08-10') }),
        mounting({
          id: 'b',
          instrument: 'GHOST',
          publishedName: 'GHOST',
          interval: nights('2026-08-11', '2026-08-14'),
        }),
      ],
    }).filter((night) => night.changes.length > 0);

    expect(marked.map((night) => [night.eveningDate, night.changes])).toEqual([['2026-08-10', ['Port 3: GHOST']]]);
  });

  it('says when an instrument comes off and nothing replaces it', () => {
    const marked = build({
      mountings: [mounting({ interval: nights('2026-08-08', '2026-08-10') })],
    }).filter((night) => night.changes.length > 0);

    expect(marked.map((night) => night.changes)).toEqual([['Port 3: GMOS off']]);
  });
});
