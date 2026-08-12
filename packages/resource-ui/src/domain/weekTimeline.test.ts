/**
 * The week timeline model: seven observing nights on one continuous axis.
 */
import { describe, expect, it } from 'vitest';

import { observingNightInterval } from './siteTime';
import { nightAt } from './timeline';
import type { Closure, Mounting } from './types';
import { buildWeekTimeline, WEEK_NIGHTS, weekNightLabels } from './weekTimeline';

const FIRST = '2026-11-14';
const ROWS = ['Port 1-up', 'Port 2', 'Port 3'];

const mounting = (over: Partial<Mounting> & Pick<Mounting, 'id' | 'rowLabel' | 'interval'>): Mounting => ({
  instrument: 'GMOS',
  publishedName: 'GMOS',
  usage: 'SCIENCE',
  port: null,
  note: null,
  ...over,
});

const build = (
  over: {
    mountings?: readonly Mounting[];
    closures?: readonly Closure[];
    nightsWithData?: ReadonlySet<string> | undefined;
  } = {},
) =>
  buildWeekTimeline({
    site: 'GS',
    firstNight: FIRST,
    rowLabels: ROWS,
    mountings: over.mountings ?? [],
    closures: over.closures ?? [],
    nightsWithData: 'nightsWithData' in over ? over.nightsWithData : undefined,
  });

describe('the week window', () => {
  it('starts at the night asked for and runs seven nights', () => {
    expect(weekNightLabels(FIRST)).toEqual([
      '2026-11-14',
      '2026-11-15',
      '2026-11-16',
      '2026-11-17',
      '2026-11-18',
      '2026-11-19',
      '2026-11-20',
    ]);
    expect(build().nights).toHaveLength(WEEK_NIGHTS);
  });

  it('is continuous, because observing nights abut exactly', () => {
    const week = build();

    // 14:00 to 14:00 means one night's end is the next one's start; there is no
    // daytime gap between them to draw.
    for (const [index, night] of week.nights.slice(1).entries()) {
      expect(night.interval.start).toBe(week.nights[index]?.interval.end);
    }
    expect(week.interval.start).toBe(observingNightInterval('GS', FIRST).start);
    expect(week.interval.end).toBe(observingNightInterval('GS', '2026-11-20').end);
  });

  it('heads each night by the evening it begins on, as the sheet does', () => {
    // A column headed 13 is the night beginning that evening, which ends on the 14th.
    expect(build().nights[0]?.eveningDate).toBe('2026-11-13');
    expect(build().nights[0]?.observingNight).toBe('2026-11-14');
  });

  it('resolves a clicked instant to the night that contains it', () => {
    const week = build();
    const third = week.nights[2];

    expect(nightAt(week.nights, third?.interval.start ?? NaN)?.observingNight).toBe('2026-11-16');
    expect(nightAt(week.nights, (third?.interval.end ?? NaN) - 1)?.observingNight).toBe('2026-11-16');
    // Ends are exclusive - a boundary instant belongs to the night it opens -
    // and an instant outside the window belongs to no night at all.
    expect(nightAt(week.nights, third?.interval.end ?? NaN)?.observingNight).toBe('2026-11-17');
    expect(nightAt(week.nights, week.interval.end)).toBeNull();
    expect(nightAt(week.nights, week.interval.start - 1)).toBeNull();
  });
});

describe('runs across the week', () => {
  it('draws a run spanning the week as one block, not seven', () => {
    // The blocks come unclipped from the range query for exactly this reason; a
    // per-night projection would return seven abutting bars with seams between.
    const week = build({
      mountings: [
        mounting({
          id: 'ghost',
          rowLabel: 'Port 1-up',
          instrument: 'GHOST',
          publishedName: 'GHOST',
          interval: {
            start: observingNightInterval('GS', '2026-08-08').start,
            end: observingNightInterval('GS', '2027-02-01').end,
          },
        }),
      ],
    });
    const blocks = week.rows.find((row) => row.key === 'Port 1-up')?.blocks ?? [];

    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.interval).toEqual(week.interval);
    expect(blocks[0]?.continuesBefore).toBe(true);
    expect(blocks[0]?.continuesAfter).toBe(true);
  });
});

describe('the telescope-state rows', () => {
  it('heads the week with Telescope, Mode and ToO rows when records reach it', () => {
    const span = { start: observingNightInterval('GS', FIRST).start, end: observingNightInterval('GS', FIRST).end };
    const week = buildWeekTimeline({
      site: 'GS',
      firstNight: FIRST,
      rowLabels: ROWS,
      mountings: [],
      closures: [{ id: 'a1', availability: 'OPEN', port: null, interval: span, reason: null }],
      tooBlocks: [{ id: 't1', tooSupport: 'NONE', interval: span, note: null }],
      modeBlocks: [{ id: 'm1', mode: 'QUEUE', programReferences: [], partner: null, interval: span, note: null }],
      nightsWithData: undefined,
    });

    expect(week.rows.map((row) => row.label)).toEqual(['Telescope', 'Mode', 'ToO', ...ROWS]);
    // The workbook records "Open" as explicitly as "Closed" - a fact, not a gap.
    expect(week.rows[0]?.blocks[0]).toMatchObject({ state: 'TELESCOPE', label: 'Open', variant: 'OPEN' });
    expect(week.rows[1]?.blocks[0]?.label).toBe('Queue');
    expect(week.rows[2]?.blocks[0]?.label).toBe('No ToOs');
    // An Open record is never a closure band.
    expect(week.bands).toEqual([]);
  });

  it('has no state rows when the week holds no such records - the gap stays a gap', () => {
    expect(build().rows.map((row) => row.label)).toEqual([...ROWS]);
  });
});

describe('nights with nothing recorded', () => {
  it('marks the nights the API reports no data for', () => {
    const week = build({ nightsWithData: new Set(['2026-11-14', '2026-11-15']) });

    expect(week.nights.filter((night) => night.dataAvailable).map((night) => night.observingNight)).toEqual([
      '2026-11-14',
      '2026-11-15',
    ]);
  });

  it('assumes data until the answer arrives, rather than greying out the week', () => {
    // An empty set and "not asked yet" are different things; treating the second
    // as the first would flash "not recorded" across every night on every load.
    const week = build({ nightsWithData: undefined });

    expect(week.nights.every((night) => night.dataAvailable)).toBe(true);
  });
});
