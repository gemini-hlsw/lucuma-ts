import { describe, expect, it } from 'vitest';

import { scheduleOf } from '@/test/fixtures/domain';

import { observingNightInterval } from './siteTime';
import { nightAt } from './timeline';
import type { InstrumentAvailabilityBlock, Schedule } from './types';
import { buildWeekTimeline, WEEK_NIGHTS, weekNightLabels } from './weekTimeline';

const FIRST = '2026-11-14';

const instrumentBlock = (
  over: Partial<InstrumentAvailabilityBlock> & Pick<InstrumentAvailabilityBlock, 'id' | 'port' | 'interval'>,
): InstrumentAvailabilityBlock => ({
  instrument: 'GMOS',
  publishedName: 'GMOS',
  usage: 'SCIENCE',
  place: null,
  note: null,
  ...over,
});

const build = (over: Partial<Schedule> = {}, nightsWithData?: ReadonlySet<string>) =>
  buildWeekTimeline({ site: 'GS', firstNight: FIRST, schedule: scheduleOf(over), nightsWithData });

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

    // 14:00 to 14:00 means one night's end is the next one's start; no daytime gap to draw.
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
    // Ends are exclusive, and an instant outside the window belongs to no night at all.
    expect(nightAt(week.nights, third?.interval.end ?? NaN)?.observingNight).toBe('2026-11-17');
    expect(nightAt(week.nights, week.interval.end)).toBeNull();
    expect(nightAt(week.nights, week.interval.start - 1)).toBeNull();
  });
});

describe('runs across the week', () => {
  it('draws a run spanning the week as one block, not seven', () => {
    // The blocks come unclipped for this reason: a per-night projection returns seven seams.
    const week = build({
      instrumentAvailability: [
        instrumentBlock({
          id: 'ghost',
          port: 1,
          instrument: 'GHOST',
          publishedName: 'GHOST',
          interval: {
            start: observingNightInterval('GS', '2026-08-08').start,
            end: observingNightInterval('GS', '2027-02-01').end,
          },
        }),
      ],
    });
    const blocks = week.rows.find((row) => row.key === 'Port 1')?.blocks ?? [];

    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.interval).toEqual(week.interval);
    expect(blocks[0]?.continuesBefore).toBe(true);
    expect(blocks[0]?.continuesAfter).toBe(true);
  });
});

describe('nights with nothing recorded', () => {
  it('marks the nights the API reports no data for', () => {
    const week = build({}, new Set(['2026-11-14', '2026-11-15']));

    expect(week.nights.filter((night) => night.dataAvailable).map((night) => night.observingNight)).toEqual([
      '2026-11-14',
      '2026-11-15',
    ]);
  });

  it('assumes data until the answer arrives, rather than greying out the week', () => {
    // An empty set and "not asked yet" differ: treating one as the other flashes "not recorded" everywhere.
    const week = build({}, undefined);

    expect(week.nights.every((night) => night.dataAvailable)).toBe(true);
  });
});
