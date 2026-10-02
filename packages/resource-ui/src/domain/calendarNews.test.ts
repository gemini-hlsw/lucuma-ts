import { describe, expect, it } from 'vitest';

import { buildCalendarNews } from './calendarNews';
import { observingNightInterval } from './siteTime';
import type { TimelineNight } from './timeline';
import type { InstrumentAvailabilityBlock } from './types';

const SITE = 'GS' as const;
const FIRST = '2026-08-02';

const nightList = (first: string, count: number): TimelineNight[] =>
  Array.from({ length: count }, (_, index) => {
    const date = new Date(`${first}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + index);
    const observingNight = date.toISOString().slice(0, 10);
    const evening = new Date(date);
    evening.setUTCDate(evening.getUTCDate() - 1);
    return {
      observingNight,
      eveningDate: evening.toISOString().slice(0, 10),
      interval: observingNightInterval(SITE, observingNight),
      isWeekend: false,
      dataAvailable: true,
    };
  });

const nights = nightList(FIRST, 10);
const windowStart = nights[0]!.interval.start;
const windowEnd = nights.at(-1)!.interval.end;
const startOfNight = (label: string) => observingNightInterval(SITE, label).start;

const instrumentBlock = (
  over: Partial<InstrumentAvailabilityBlock> & Pick<InstrumentAvailabilityBlock, 'id' | 'interval'>,
): InstrumentAvailabilityBlock => ({
  instrument: 'GMOS',
  publishedName: 'GMOS',
  usage: 'SCIENCE',
  port: 1,
  place: null,
  note: null,
  ...over,
});

describe(buildCalendarNews, () => {
  it('turns a port swap into one chip naming both instruments, on the evening it happens', () => {
    const swap = startOfNight('2026-08-05');
    const items = buildCalendarNews({
      nights,
      instrumentAvailability: [
        instrumentBlock({
          id: 'a',
          publishedName: 'IGRINS-2',
          instrument: 'IGRINS2',
          interval: { start: windowStart, end: swap },
        }),
        instrumentBlock({
          id: 'b',
          publishedName: 'MAROON-X',
          instrument: 'MAROON_X',
          interval: { start: swap, end: windowEnd },
        }),
      ],
      telescopeAvailability: [],
    });

    // One chip, not an "out" and an "in" saying the same thing twice.
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      eveningDate: '2026-08-04',
      kind: 'INSTRUMENT',
      label: 'IGRINS-2 → MAROON-X',
      instrument: 'MAROON_X',
    });
  });

  it('phrases a usability change by the new usage, since the instrument stays', () => {
    const fails = startOfNight('2026-08-04');
    const returns = startOfNight('2026-08-07');
    const items = buildCalendarNews({
      nights,
      instrumentAvailability: [
        instrumentBlock({
          id: 'a',
          publishedName: 'GNIRS',
          instrument: 'GNIRS',
          interval: { start: windowStart, end: fails },
        }),
        instrumentBlock({
          id: 'b',
          publishedName: 'GNIRS',
          instrument: 'GNIRS',
          usage: 'UNAVAILABLE',
          interval: { start: fails, end: returns },
        }),
        instrumentBlock({
          id: 'c',
          publishedName: 'GNIRS',
          instrument: 'GNIRS',
          interval: { start: returns, end: windowEnd },
        }),
      ],
      telescopeAvailability: [],
    });

    expect(items.map((item) => item.label)).toEqual(['GNIRS: Not available', 'GNIRS: Science']);
  });

  it('says in or out when only one side of the boundary holds anything', () => {
    const arrives = startOfNight('2026-08-06');
    const items = buildCalendarNews({
      nights,
      instrumentAvailability: [
        instrumentBlock({
          id: 'a',
          publishedName: 'Zorro',
          instrument: 'CAL_ZORRO',
          interval: { start: arrives, end: windowEnd },
        }),
      ],
      telescopeAvailability: [],
    });

    expect(items[0]?.label).toBe('Zorro in');
  });

  it('marks the telescope closing and reopening, never the closed span itself', () => {
    const closes = startOfNight('2026-08-05');
    const reopens = startOfNight('2026-08-08');
    const items = buildCalendarNews({
      nights,
      instrumentAvailability: [],
      telescopeAvailability: [
        { id: 'c', availability: 'CLOSED', port: null, interval: { start: closes, end: reopens }, reason: 'Shutdown' },
      ],
    });

    expect(items).toEqual([
      {
        eveningDate: '2026-08-04',
        kind: 'CLOSED',
        label: 'Shutdown',
        rowLabel: null,
        instrument: null,
        detail: 'Shutdown',
      },
      { eveningDate: '2026-08-07', kind: 'OPEN', label: 'Open', rowLabel: null, instrument: null, detail: null },
    ]);
  });

  it('treats the window edges as furniture: what was always there is not news', () => {
    const items = buildCalendarNews({
      nights,
      instrumentAvailability: [instrumentBlock({ id: 'a', interval: { start: windowStart, end: windowEnd } })],
      telescopeAvailability: [
        {
          id: 'open',
          availability: 'OPEN',
          port: null,
          interval: { start: windowStart, end: windowEnd },
          reason: null,
        },
      ],
    });

    expect(items).toEqual([]);
  });
});
