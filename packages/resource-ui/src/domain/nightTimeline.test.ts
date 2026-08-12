/**
 * The night timeline model.
 *
 * The published sheets are whole-night granular, so every night the mock serves
 * is uniform. The partial-night cases here are synthetic on purpose: PLAN.md
 * §3.1 says the model must never assume night alignment, and this is the only
 * view that can show whether that is still true. If these break, the capability
 * has been lost regardless of what the published data happens to contain.
 */
import { describe, expect, it } from 'vitest';

import { buildNightTimeline } from './nightTimeline';
import { observingNightInterval } from './siteTime';
import { MODE_ROW_LABEL, TOO_ROW_LABEL } from './timeline';
import type { Closure, ModeBlock, Mounting, TooBlock } from './types';

const NIGHT = '2026-11-14';
const interval = observingNightInterval('GS', NIGHT);
const ROWS = ['Port 1-up', 'Port 2', 'Port 3'];

const HOUR = 3_600_000;

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
    tooBlocks?: readonly TooBlock[];
    modeBlocks?: readonly ModeBlock[];
  } = {},
) =>
  buildNightTimeline({
    site: 'GS',
    observingNight: NIGHT,
    rowLabels: ROWS,
    mountings: over.mountings ?? [],
    closures: over.closures ?? [],
    tooBlocks: over.tooBlocks ?? [],
    modeBlocks: over.modeBlocks ?? [],
  });

const rowIn = (timeline: ReturnType<typeof build>, row: string) => timeline.rows.find((entry) => entry.key === row);

describe('the night window', () => {
  it('runs 14:00 to 14:00 site-local, labelled by the date it ends', () => {
    const night = build();

    expect(night.interval).toEqual(interval);
    expect(night.observingNight).toBe(NIGHT);
  });

  it('clips a run that spans the semester down to tonight, and says it continues', () => {
    const night = build({
      mountings: [
        mounting({
          id: 'ghost',
          rowLabel: 'Port 1-up',
          instrument: 'GHOST',
          publishedName: 'GHOST',
          interval: { start: interval.start - 100 * 24 * HOUR, end: interval.end + 60 * 24 * HOUR },
        }),
      ],
    });
    const block = rowIn(night, 'Port 1-up')?.blocks[0];

    expect(block?.interval).toEqual(interval);
    expect(block?.continuesBefore).toBe(true);
    expect(block?.continuesAfter).toBe(true);
  });

  it('reports no transitions when the night is uniform, which every published night is', () => {
    const night = build({
      mountings: [mounting({ id: 'a', rowLabel: 'Port 3', interval })],
    });

    expect(night.transitions).toEqual([]);
  });
});

describe('partial nights', () => {
  // The load-bearing constraint (PLAN.md §3.1): nothing in the model ever
  // assumed a block covers a whole night, so a mid-night change needs no
  // special case - it is simply two blocks with a boundary between them.
  const CHANGEOVER = interval.start + 9 * HOUR;
  const SPLIT_NIGHT: readonly Mounting[] = [
    mounting({
      id: 'first',
      rowLabel: 'Port 3',
      instrument: 'GMOS',
      publishedName: 'GMOS',
      interval: { start: interval.start, end: CHANGEOVER },
    }),
    mounting({
      id: 'second',
      rowLabel: 'Port 3',
      instrument: 'F2',
      publishedName: 'F2',
      interval: { start: CHANGEOVER, end: interval.end },
    }),
  ];

  it('draws a mid-night changeover as two blocks meeting at the boundary', () => {
    const blocks = rowIn(build({ mountings: SPLIT_NIGHT }), 'Port 3')?.blocks ?? [];

    expect(blocks.map((block) => block.label)).toEqual(['GMOS', 'F2']);
    expect(blocks[0]?.interval.end).toBe(CHANGEOVER);
    expect(blocks[1]?.interval.start).toBe(CHANGEOVER);
  });

  it('names the instant the change happens, so it is not left to a seam in the bars', () => {
    expect(build({ mountings: SPLIT_NIGHT }).transitions).toEqual([CHANGEOVER]);
  });

  it('keeps both instruments in the legend', () => {
    expect(build({ mountings: SPLIT_NIGHT }).instruments).toEqual(['F2', 'GMOS']);
  });

  it('lists several changes in order, without repeating a shared boundary', () => {
    const night = build({
      mountings: [
        ...SPLIT_NIGHT,
        mounting({
          id: 'other',
          rowLabel: 'Port 2',
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
  const too = (over: Partial<TooBlock> & Pick<TooBlock, 'id' | 'tooSupport' | 'interval'>): TooBlock => ({
    note: null,
    ...over,
  });
  const mode = (over: Partial<ModeBlock> & Pick<ModeBlock, 'id' | 'mode' | 'interval'>): ModeBlock => ({
    programReference: null,
    note: null,
    ...over,
  });

  it('shows no state rows when the night carries no records, so a gap stays a gap', () => {
    // I4: two permanently empty rows on every published night would read as
    // "nothing recorded" chrome nobody entered.
    expect(build().rows.map((row) => row.key)).toEqual(ROWS);
  });

  it('heads the chart with Mode then ToO when the night has records', () => {
    const night = build({
      tooBlocks: [too({ id: 't', tooSupport: 'STANDARD', interval })],
      modeBlocks: [mode({ id: 'm', mode: 'QUEUE', interval })],
    });

    expect(night.rows.map((row) => row.key)).toEqual([MODE_ROW_LABEL, TOO_ROW_LABEL, ...ROWS]);
  });

  it('prints the recorded value on the block, in its operational spelling', () => {
    const night = build({
      tooBlocks: [too({ id: 't', tooSupport: 'NONE', interval })],
      modeBlocks: [mode({ id: 'm', mode: 'PRIORITY_VISITOR', interval })],
    });

    expect(rowIn(night, TOO_ROW_LABEL)?.blocks[0]?.label).toBe('No ToOs');
    expect(rowIn(night, MODE_ROW_LABEL)?.blocks[0]?.label).toBe('Priority visitor');
  });

  it('draws a mid-night ToO change as two blocks and names the instant', () => {
    // The independence the blocks were split out for: ToO support changes at
    // an instant no port row changes at, and the row shows exactly where.
    const change = interval.start + 7 * HOUR;
    const night = build({
      tooBlocks: [
        too({ id: 'before', tooSupport: 'STANDARD', interval: { start: interval.start, end: change } }),
        too({ id: 'after', tooSupport: 'RAPID', interval: { start: change, end: interval.end } }),
      ],
    });

    expect(rowIn(night, TOO_ROW_LABEL)?.blocks.map((block) => block.label)).toEqual(['Standard ToOs', 'Rapid ToOs']);
    expect(night.transitions).toEqual([change]);
  });

  it('hands the tooltip the program a classical span is for', () => {
    const night = build({
      modeBlocks: [mode({ id: 'm', mode: 'CLASSICAL', programReference: 'G-2099B-0042-C', interval })],
    });

    expect(rowIn(night, MODE_ROW_LABEL)?.blocks[0]?.detail).toBe('G-2099B-0042-C');
  });

  it('keeps state blocks out of the instrument legend and the unscheduled key', () => {
    const night = build({
      tooBlocks: [too({ id: 't', tooSupport: 'STANDARD', interval })],
      modeBlocks: [mode({ id: 'm', mode: 'QUEUE', interval })],
    });

    expect(night.instruments).toEqual([]);
    expect(night.hasUnscheduled).toBe(false);
  });
});

describe('the sun', () => {
  it('finds the night dark between dusk and dawn', () => {
    const { sun } = build();

    // Cerro Pachon in November: the sun sets late and rises early.
    expect(sun.sunset).not.toBeNull();
    expect(sun.sunrise).not.toBeNull();
    expect(sun.duskAstronomical).toBeGreaterThan(sun.sunset ?? 0);
    expect(sun.dawnAstronomical).toBeLessThan(sun.sunrise ?? 0);
  });
});
