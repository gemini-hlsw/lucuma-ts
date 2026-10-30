/** The partial-night cases are synthetic on purpose: only this view can show the capability holds. */
import { describe, expect, it } from 'vitest';

import { scheduleOf } from '@/test/fixtures/domain';

import { buildNightTimeline } from './nightTimeline';
import { observingNightInterval } from './siteTime';
import { MODE_ROW_LABEL, TOO_ROW_LABEL, TOO_SUPPORT_LABEL } from './timeline';
import type { InstrumentAvailabilityBlock, Schedule, TelescopeModeBlock, TooSupportBlock } from './types';

const NIGHT = '2026-11-14';
const interval = observingNightInterval('GS', NIGHT);
const HOUR = 3_600_000;

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

const build = (over: Partial<Schedule> = {}) =>
  buildNightTimeline({ site: 'GS', observingNight: NIGHT, schedule: scheduleOf(over) });

const rowIn = (timeline: ReturnType<typeof build>, row: string) => timeline.rows.find((entry) => entry.key === row);

describe('the night window', () => {
  it('runs 14:00 to 14:00 site-local, labelled by the date it ends', () => {
    const night = build();

    expect(night.interval).toEqual(interval);
    expect(night.observingNight).toBe(NIGHT);
  });

  it('reports no transitions when the night is uniform, which every published night is', () => {
    const night = build({
      instrumentAvailability: [instrumentBlock({ id: 'a', port: 3, interval })],
    });

    expect(night.transitions).toEqual([]);
  });
});

describe('partial nights', () => {
  // Nothing ever assumed a block covers a whole night, so a mid-night change needs no special case.
  const CHANGEOVER = interval.start + 9 * HOUR;
  const SPLIT_NIGHT: readonly InstrumentAvailabilityBlock[] = [
    instrumentBlock({
      id: 'first',
      port: 3,
      instrument: 'GMOS',
      publishedName: 'GMOS',
      interval: { start: interval.start, end: CHANGEOVER },
    }),
    instrumentBlock({
      id: 'second',
      port: 3,
      instrument: 'F2',
      publishedName: 'F2',
      interval: { start: CHANGEOVER, end: interval.end },
    }),
  ];

  it('draws a mid-night changeover as two blocks meeting at the boundary', () => {
    const blocks = rowIn(build({ instrumentAvailability: SPLIT_NIGHT }), 'Port 3')?.blocks ?? [];

    expect(blocks.map((block) => block.label)).toEqual(['GMOS', 'F2']);
    expect(blocks[0]?.interval.end).toBe(CHANGEOVER);
    expect(blocks[1]?.interval.start).toBe(CHANGEOVER);
  });

  it('names the instant the change happens, so it is not left to a seam in the bars', () => {
    expect(build({ instrumentAvailability: SPLIT_NIGHT }).transitions).toEqual([CHANGEOVER]);
  });

  it('keeps both instruments in the legend', () => {
    expect(build({ instrumentAvailability: SPLIT_NIGHT }).legend.instruments).toEqual(['F2', 'GMOS']);
  });

  it('lists several changes in order, without repeating a shared boundary', () => {
    const night = build({
      instrumentAvailability: [
        ...SPLIT_NIGHT,
        instrumentBlock({
          id: 'other',
          port: 2,
          instrument: 'GHOST',
          publishedName: 'GHOST',
          interval: { start: interval.start + 3 * HOUR, end: interval.end },
        }),
      ],
    });

    // The changeover boundary is one instant even though two blocks touch it.
    expect(night.transitions).toEqual([interval.start + 3 * HOUR, CHANGEOVER]);
  });
});

describe('the telescope-state rows', () => {
  const too = (
    over: Partial<TooSupportBlock> & Pick<TooSupportBlock, 'id' | 'tooSupport' | 'interval'>,
  ): TooSupportBlock => ({
    note: null,
    ...over,
  });
  const mode = (
    over: Partial<TelescopeModeBlock> & Pick<TelescopeModeBlock, 'id' | 'mode' | 'interval'>,
  ): TelescopeModeBlock => ({
    programReferences: [],
    partner: null,
    note: null,
    ...over,
  });

  it('draws a mid-night ToO change as two blocks and names the instant', () => {
    // ToO support changes at an instant no port row changes at, and the row shows where.
    const change = interval.start + 7 * HOUR;
    const night = build({
      tooSupport: [
        too({ id: 'before', tooSupport: 'STANDARD', interval: { start: interval.start, end: change } }),
        too({ id: 'after', tooSupport: 'RAPID', interval: { start: change, end: interval.end } }),
      ],
    });

    expect(rowIn(night, TOO_ROW_LABEL)?.blocks.map((block) => block.label)).toEqual([
      TOO_SUPPORT_LABEL.STANDARD,
      TOO_SUPPORT_LABEL.RAPID,
    ]);
    expect(night.transitions).toEqual([change]);
  });

  it('hands the tooltip the programs a classical span is for', () => {
    const night = build({
      telescopeMode: [
        mode({ id: 'm', mode: 'CLASSICAL', programReferences: ['G-2099B-0042-C', 'G-2099B-0043-C'], interval }),
      ],
    });

    expect(rowIn(night, MODE_ROW_LABEL)?.blocks[0]?.detail).toBe('G-2099B-0042-C, G-2099B-0043-C');
  });

  it('hands the tooltip the partner a block-scheduling span belongs to', () => {
    const night = build({
      telescopeMode: [mode({ id: 'm', mode: 'BLOCK_SCHEDULING', partner: 'UH', interval })],
    });

    const block = rowIn(night, MODE_ROW_LABEL)?.blocks[0];
    expect(block?.label).toBe('Block scheduling');
    expect(block?.detail).toBe('University of Hawaii');
  });
});
