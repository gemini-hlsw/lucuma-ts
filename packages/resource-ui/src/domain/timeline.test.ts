import { describe, expect, it } from 'vitest';

import { scheduleOf } from '@/test/fixtures/domain';

import { portRowLabel } from './ports';
import { observingNightInterval } from './siteTime';
import {
  MODE_ROW_LABEL,
  projectWindow,
  TELESCOPE_MODE_LABEL,
  TELESCOPE_ROW_LABEL,
  type TimelineLegend,
  type TimelineNight,
  timelineNights,
  TOO_ROW_LABEL,
  TOO_SUPPORT_LABEL,
} from './timeline';
import type { InstrumentAvailabilityBlock, Schedule, TelescopeAvailabilityBlock } from './types';

const NIGHT = '2026-11-14';
const HOUR = 3_600_000;
const nights = timelineNights('GS', [NIGHT]);
const tonight = observingNightInterval('GS', NIGHT);

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

const closure = (
  over: Partial<TelescopeAvailabilityBlock> & Pick<TelescopeAvailabilityBlock, 'id' | 'interval'>,
): TelescopeAvailabilityBlock => ({
  availability: 'CLOSED',
  port: null,
  reason: null,
  ...over,
});

/** Any subset of a schedule over the single empty night, unless the window's own nights are given. */
const project = (over: Partial<Schedule> = {}, windowNights: readonly TimelineNight[] = nights) =>
  projectWindow({ nights: windowNights, schedule: scheduleOf(over) });

describe(projectWindow, () => {
  it('spans its nights and clips a longer run to them, saying it continues both ways', () => {
    const window = project({
      instrumentAvailability: [
        instrumentBlock({ id: 'gmos', port: 3, interval: { start: tonight.start - HOUR, end: tonight.end + HOUR } }),
      ],
    });

    expect(window.interval).toEqual(tonight);
    const row = window.rows.find((entry) => entry.key === portRowLabel(3));
    expect(row?.blocks).toEqual([
      expect.objectContaining({ label: 'GMOS', interval: tonight, continuesBefore: true, continuesAfter: true }),
    ]);
  });

  it('heads the window with Telescope, Mode and ToO rows only when records reach it', () => {
    expect(project().rows.map((row) => row.label)).not.toContain(TELESCOPE_ROW_LABEL);

    const window = project({
      telescopeAvailability: [closure({ id: 'open', availability: 'OPEN', interval: tonight })],
      telescopeMode: [
        { id: 'mode', mode: 'CLASSICAL', interval: tonight, programReferences: [], partner: null, note: null },
      ],
      tooSupport: [{ id: 'too', tooSupport: 'RAPID', interval: tonight, note: null }],
    });

    expect(window.rows.slice(0, 3).map((row) => row.label)).toEqual([
      TELESCOPE_ROW_LABEL,
      MODE_ROW_LABEL,
      TOO_ROW_LABEL,
    ]);
    // The workbook records "Open" as explicitly as "Closed" - a fact, not a gap, and never a closure band.
    expect(window.rows[0]?.blocks[0]).toMatchObject({ state: 'TELESCOPE', label: 'Open', variant: 'OPEN' });
    expect(window.rows[1]?.blocks[0]?.label).toBe(TELESCOPE_MODE_LABEL.CLASSICAL);
    expect(window.rows[2]?.blocks[0]?.label).toBe(TOO_SUPPORT_LABEL.RAPID);
    expect(window.bands).toEqual([]);
  });

  it('heads a window with no telescope record with the Mode and ToO rows alone', () => {
    const window = project({
      telescopeMode: [
        { id: 'mode', mode: 'QUEUE', interval: tonight, programReferences: [], partner: null, note: null },
      ],
      tooSupport: [{ id: 'too', tooSupport: 'NONE', interval: tonight, note: null }],
    });

    expect(window.rows.slice(0, 2).map((row) => row.label)).toEqual([MODE_ROW_LABEL, TOO_ROW_LABEL]);
  });

  it('draws a telescope-wide closure as one band', () => {
    const shutdown = { start: tonight.start + 2 * HOUR, end: tonight.start + 5 * HOUR };
    const window = project({ telescopeAvailability: [closure({ id: 'shut', interval: shutdown, reason: 'Snow' })] });

    expect(window.bands).toEqual([{ id: 'shut', interval: shutdown, label: 'Snow' }]);
  });

  describe('the legend keys only what the window contains', () => {
    const NOTHING: TimelineLegend = {
      instruments: [],
      modes: [],
      toos: [],
      hasOpen: false,
      hasClosure: false,
      hasUnscheduled: false,
      hasEngineeringUse: false,
      hasUnavailable: false,
      hasWeekend: false,
      hasNoData: false,
    };
    const half = { start: tonight.start, end: tonight.start + 5 * HOUR };
    const rest = { start: half.end, end: tonight.end };
    const modeBlock = (id: string, mode: 'QUEUE' | 'SHUTDOWN', interval: { start: number; end: number }) => ({
      id,
      mode,
      interval,
      programReferences: [],
      partner: null,
      note: null,
    });

    it('keys nothing for an empty window', () => {
      expect(project().legend).toEqual(NOTHING);
    });

    const CASES: readonly {
      what: string;
      over?: Partial<Schedule>;
      nights?: readonly TimelineNight[];
      keys: Partial<TimelineLegend>;
    }[] = [
      {
        what: 'the placed instruments, alphabetically, with their usage treatments',
        over: {
          instrumentAvailability: [
            instrumentBlock({ id: 'gnirs', port: 1, instrument: 'GNIRS', interval: tonight }),
            instrumentBlock({ id: 'gmos', port: 3, interval: tonight, usage: 'ENGINEERING' }),
          ],
        },
        keys: { instruments: ['GMOS', 'GNIRS'], hasEngineeringUse: true },
      },
      {
        what: 'the not-available treatment',
        over: {
          instrumentAvailability: [instrumentBlock({ id: 'gmos', port: 3, interval: tonight, usage: 'UNAVAILABLE' })],
        },
        keys: { instruments: ['GMOS'], hasUnavailable: true },
      },
      {
        what: 'nothing for a block that misses the window',
        over: { instrumentAvailability: [instrumentBlock({ id: 'gone', port: 5, interval: { start: 0, end: 1 } })] },
        keys: {},
      },
      {
        what: 'a telescope-wide closure, which no row carries',
        over: { telescopeAvailability: [closure({ id: 'shut', interval: half, reason: 'Snow' })] },
        keys: { hasClosure: true },
      },
      {
        what: 'a port closure as unscheduled, apart from the instruments',
        over: { telescopeAvailability: [closure({ id: 'ag', port: 4, interval: half, reason: 'A&G' })] },
        keys: { hasUnscheduled: true },
      },
      {
        what: 'the open span, never as an instrument',
        over: { telescopeAvailability: [closure({ id: 'open', availability: 'OPEN', interval: tonight })] },
        keys: { hasOpen: true },
      },
      {
        what: 'the modes placed in the window, once each',
        over: {
          telescopeMode: [
            modeBlock('m1', 'QUEUE', half),
            modeBlock('m2', 'SHUTDOWN', rest),
            modeBlock('m3', 'QUEUE', { start: 0, end: 1 }),
          ],
        },
        keys: { modes: ['QUEUE', 'SHUTDOWN'] },
      },
      {
        what: 'the ToO levels, never as instruments',
        over: { tooSupport: [{ id: 'too', tooSupport: 'NONE', interval: tonight, note: null }] },
        keys: { toos: ['NONE'] },
      },
      {
        what: 'nothing recorded for a night',
        nights: timelineNights('GS', ['2026-11-17', '2026-11-18'], (night) => night !== '2026-11-18'),
        keys: { hasNoData: true },
      },
    ];

    it.each(CASES)('keys $what', ({ over, nights: windowNights, keys }) => {
      expect(project(over, windowNights).legend).toEqual({ ...NOTHING, ...keys });
    });

    // The night of the 15th begins on Saturday the 14th; the 14th's own evening is Friday the 13th.
    it.each([
      { nights: ['2026-11-14', '2026-11-15', '2026-11-16'], hasWeekend: true },
      { nights: ['2026-11-17', '2026-11-18'], hasWeekend: false },
      { nights: ['2026-11-15'], hasWeekend: false },
    ])('keys the weekend only when a window of several nights holds one: $nights', ({ nights: labels, hasWeekend }) => {
      expect(project({}, timelineNights('GS', labels)).legend.hasWeekend).toBe(hasWeekend);
    });
  });
});
