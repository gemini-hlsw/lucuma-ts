/**
 * The instrument finder: one row per instrument, answered for a night.
 *
 * The cases that matter are the ones the schedule views cannot show - an
 * instrument on no port, and an instrument with nothing recorded tonight.
 */
import { describe, expect, it } from 'vitest';

import { buildInstrumentRows, matchesInstrument, runsOf } from './instrumentFinder';
import { observingNightInterval } from './siteTime';
import type { Mounting } from './types';

const SITE = 'GS' as const;
const NIGHT = '2026-08-10';
const night = observingNightInterval(SITE, NIGHT);

/** A span covering whole observing nights, inclusive of both. */
const nights = (first: string, last: string) => ({
  start: observingNightInterval(SITE, first).start,
  end: observingNightInterval(SITE, last).end,
});

const mounting = (over: Partial<Mounting> = {}): Mounting => ({
  id: 'm1',
  instrument: 'GMOS',
  publishedName: 'GMOS-S',
  usage: 'SCIENCE',
  rowLabel: 'Port 3',
  port: 3,
  locationType: 'PORT',
  interval: nights('2026-08-08', '2026-08-14'),
  note: null,
  ...over,
});

describe('buildInstrumentRows', () => {
  it('says which port an instrument is on tonight, and how long the run is', () => {
    const [row] = buildInstrumentRows({ mountings: [mounting()], night });

    expect(row).toMatchObject({ instrument: 'GMOS', publishedName: 'GMOS-S', usage: 'SCIENCE' });
    expect(row?.where).toEqual({ kind: 'PORT', port: 3, rowLabel: 'Port 3' });
    expect(row?.run).toEqual(nights('2026-08-08', '2026-08-14'));
  });

  it('says an instrument is on no port rather than inventing a place for it', () => {
    // The workbook's usable-with-no-port run: it never says where the
    // instrument physically sits, so the row must not claim one.
    const [row] = buildInstrumentRows({
      mountings: [mounting({ instrument: 'CAL_ZORRO', rowLabel: 'Zorro', port: null, locationType: 'UNKNOWN' })],
      night,
    });

    expect(row?.where).toEqual({ kind: 'OFF_PORT', location: 'UNKNOWN' });
    expect(row?.usage).toBe('SCIENCE');
  });

  it('reports a night with no record as unrecorded, never as unavailable (I4)', () => {
    const [row] = buildInstrumentRows({
      mountings: [mounting({ interval: nights('2026-09-01', '2026-09-05') })],
      night,
    });

    expect(row?.where).toEqual({ kind: 'NOT_RECORDED' });
    expect(row?.usage).toBeNull();
    expect(row?.run).toBeNull();
  });

  it('reports where an instrument ended up when it moves during the night', () => {
    const changeover = night.start + 9 * 3_600_000;
    const [row] = buildInstrumentRows({
      mountings: [
        mounting({ id: 'a', interval: { start: night.start, end: changeover } }),
        mounting({ id: 'b', rowLabel: 'Port 5', port: 5, interval: { start: changeover, end: night.end } }),
      ],
      night,
    });

    expect(row?.where).toEqual({ kind: 'PORT', port: 5, rowLabel: 'Port 5' });
    expect(row?.changesTonight).toBe(true);
    expect(row?.transitions).toEqual([changeover]);
  });

  it('lists the instruments the records name, not the whole enum', () => {
    // A site's browser holds what that site's schedule holds; nine permanently
    // blank rows would bury the ones that mean something.
    const rows = buildInstrumentRows({
      mountings: [mounting({ instrument: 'GHOST' }), mounting({ instrument: 'F2' })],
      night,
    });

    expect(rows.map((row) => row.instrument)).toEqual(['F2', 'GHOST']);
  });
});

describe('runsOf', () => {
  it('gives an instrument its runs over the window, oldest first', () => {
    const later = mounting({ id: 'b', interval: nights('2026-09-01', '2026-09-05') });
    const earlier = mounting({ id: 'a', interval: nights('2026-08-01', '2026-08-05') });

    expect(runsOf('GMOS', [later, earlier]).map((run) => run.id)).toEqual(['a', 'b']);
  });
});

describe('matchesInstrument', () => {
  it('matches the enum tag and the name the schedule prints, case-insensitively', () => {
    const [row] = buildInstrumentRows({ mountings: [mounting()], night });

    expect(matchesInstrument(row!, 'gmos-s')).toBe(true);
    expect(matchesInstrument(row!, 'GMOS')).toBe(true);
    expect(matchesInstrument(row!, '')).toBe(true);
    expect(matchesInstrument(row!, 'ghost')).toBe(false);
  });
});
