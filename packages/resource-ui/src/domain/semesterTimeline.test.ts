/**
 * The semester timeline model.
 *
 * Anchored on the real Gemini South shape: one telescope-wide closure carrying
 * the whole phrase, port closures carrying a word of it each, and A&G running
 * the length of the semester on Port 4.
 */
import { describe, expect, it } from 'vitest';

import { buildSemesterTimeline } from './semesterTimeline';
import { observingNightInterval } from './siteTime';
import { clip, subtract } from './timeline';
import type { Closure, Mounting } from './types';

const night = (label: string) => observingNightInterval('GS', label);

/** [start of the night labelled `from`, end of the night labelled `to`). */
const span = (from: string, to: string) => ({ start: night(from).start, end: night(to).end });

const ROWS = ['Port 1-up', 'Port 2', 'Port 3', 'Port 4', 'Port 5'];

const mounting = (over: Partial<Mounting> & Pick<Mounting, 'id' | 'rowLabel' | 'interval'>): Mounting => ({
  instrument: 'GMOS',
  publishedName: 'GMOS',
  usage: 'SCIENCE',
  port: null,
  locationType: 'UNKNOWN',
  note: null,
  ...over,
});

const closure = (over: Partial<Closure> & Pick<Closure, 'id' | 'interval'>): Closure => ({
  availability: 'CLOSED',
  port: null,
  reason: null,
  ...over,
});

const build = (over: { mountings?: readonly Mounting[]; closures?: readonly Closure[] } = {}) =>
  buildSemesterTimeline({
    site: 'GS',
    rowLabels: ROWS,
    firstNight: '2026-08-02',
    lastNight: '2027-02-01',
    mountings: over.mountings ?? [],
    closures: over.closures ?? [],
  });

const rowIn = (timeline: ReturnType<typeof build>, monthLabel: string, row: string) =>
  timeline.months.find((month) => month.label === monthLabel)?.rows.find((entry) => entry.key === row);

describe('interval helpers', () => {
  it('clips to the overlap, and reports nothing when there is none', () => {
    expect(clip({ start: 10, end: 30 }, { start: 20, end: 50 })).toEqual({ start: 20, end: 30 });
    expect(clip({ start: 10, end: 20 }, { start: 20, end: 50 })).toBeNull();
  });

  it('subtracts a hole from the middle, leaving both sides', () => {
    expect(subtract({ start: 0, end: 100 }, [{ start: 40, end: 60 }])).toEqual([
      { start: 0, end: 40 },
      { start: 60, end: 100 },
    ]);
  });

  it('leaves nothing when the hole covers the whole interval', () => {
    expect(subtract({ start: 10, end: 20 }, [{ start: 0, end: 100 }])).toEqual([]);
  });

  it('leaves the interval untouched when the hole misses it', () => {
    expect(subtract({ start: 0, end: 10 }, [{ start: 50, end: 60 }])).toEqual([{ start: 0, end: 10 }]);
  });
});

describe('closures at Gemini South', () => {
  // The published shape: the sheet spells "Telescope Shutdown A&G Maintenance"
  // down the port rows one word at a time, and the importer records both the
  // fragments and the telescope-wide record that carries the whole phrase.
  const SHUTDOWN = span('2026-08-02', '2026-08-07');
  const PUBLISHED_CLOSURES = [
    closure({ id: 'wide', port: null, interval: SHUTDOWN, reason: 'Telescope Shutdown A&G Maintenance' }),
    closure({ id: 'c1', port: 1, interval: SHUTDOWN, reason: null }),
    closure({ id: 'c2', port: 2, interval: SHUTDOWN, reason: 'Telescope' }),
    closure({ id: 'c3', port: 3, interval: SHUTDOWN, reason: 'Shutdown' }),
    closure({ id: 'c5', port: 5, interval: SHUTDOWN, reason: 'Maintenance' }),
  ];

  it('draws the telescope-wide closure once, as a band with the whole phrase', () => {
    const august = build({ closures: PUBLISHED_CLOSURES }).months[0];

    expect(august?.bands).toHaveLength(1);
    expect(august?.bands[0]?.label).toBe('Telescope Shutdown A&G Maintenance');
  });

  it('drops the per-port fragments the sheet spells down the rows', () => {
    const timeline = build({ closures: PUBLISHED_CLOSURES });

    // Port 2 said "Telescope" and Port 3 said "Shutdown". Rendered per row that
    // reads as though the ports were named that, which is the bug this fixes.
    for (const row of ROWS) {
      expect(rowIn(timeline, 'August 2026', row)?.blocks).toEqual([]);
    }
  });

  it('keeps the part of a port closure that outlasts the shutdown', () => {
    // A&G runs the whole semester on Port 4 and merely overlaps the shutdown.
    const timeline = build({
      closures: [
        ...PUBLISHED_CLOSURES,
        closure({ id: 'ag', port: 4, interval: span('2026-08-02', '2027-02-01'), reason: 'A&G' }),
      ],
    });
    const august = rowIn(timeline, 'August 2026', 'Port 4');

    expect(august?.blocks).toHaveLength(1);
    expect(august?.blocks[0]?.label).toBe('A&G');
    expect(august?.blocks[0]?.state).toBe('UNSCHEDULED');
    // It begins where the shutdown ends, not where the sheet's run begins.
    expect(august?.blocks[0]?.interval.start).toBe(SHUTDOWN.end);
  });

  it('reports the closure for the legend even though no row carries it', () => {
    const timeline = build({ closures: PUBLISHED_CLOSURES });

    expect(timeline.hasClosure).toBe(true);
    expect(timeline.instruments).toEqual([]);
  });
});

describe('unknown bands', () => {
  it('lets an identified run win the span it shares with an unknown band', () => {
    // Gemini North's sheet has two physical "Visiting" rows sharing one label,
    // so an unidentified (UNKNOWN) band can genuinely coincide with a named
    // run - 'Alopeke inside the light-orange MIQ band in GN 2026B. One chart
    // row cannot draw both, so the named run keeps its whole span and the
    // unknown keeps only what is its own.
    const timeline = build({
      mountings: [
        mounting({
          id: 'miq',
          rowLabel: 'Port 2',
          instrument: 'UNKNOWN',
          publishedName: 'Unknown',
          interval: span('2026-09-25', '2026-10-22'),
        }),
        mounting({
          id: 'alopeke',
          rowLabel: 'Port 2',
          instrument: 'ALOPEKE',
          publishedName: "'Alopeke Run",
          interval: span('2026-09-25', '2026-10-01'),
        }),
      ],
    });

    const september = rowIn(timeline, 'September 2026', 'Port 2');
    const october = rowIn(timeline, 'October 2026', 'Port 2');

    // September holds only the named run - the unknown's overlap is subtracted.
    expect(september?.blocks.map((block) => block.label)).toEqual(["'Alopeke Run"]);
    // October holds the unknown's own remainder, starting where 'Alopeke ends.
    expect(october?.blocks.map((block) => block.label)).toEqual(['Unknown']);
    expect(october?.blocks[0]?.fullInterval.start).toBe(night('2026-10-01').end);
  });
});

describe('months', () => {
  const GHOST = mounting({
    id: 'ghost',
    rowLabel: 'Port 1-up',
    instrument: 'GHOST',
    publishedName: 'GHOST',
    interval: span('2026-08-08', '2027-02-01'),
  });

  it('files a night under the month its evening falls in, as the sheet does', () => {
    const timeline = build();

    // The night labelled 2026-09-01 begins on the evening of August 31, so the
    // sheet prints it in the August block.
    expect(timeline.months.map((month) => month.label)).toEqual([
      'August 2026',
      'September 2026',
      'October 2026',
      'November 2026',
      'December 2026',
      'January 2027',
    ]);
    expect(timeline.months[0]?.nights.at(-1)?.eveningDate).toBe('2026-08-31');
    expect(timeline.months[0]?.nights.at(-1)?.observingNight).toBe('2026-09-01');
  });

  it('clips a run to each month it crosses and says which edges are cut', () => {
    const timeline = build({ mountings: [GHOST] });
    const august = rowIn(timeline, 'August 2026', 'Port 1-up')?.blocks[0];
    const october = rowIn(timeline, 'October 2026', 'Port 1-up')?.blocks[0];

    expect(august?.continuesBefore).toBe(false);
    expect(august?.continuesAfter).toBe(true);
    // A middle month is cut at both ends, and both cuts are reported so the
    // tooltip can say the run continues rather than implying it stops here.
    expect(october?.continuesBefore).toBe(true);
    expect(october?.continuesAfter).toBe(true);
  });

  it('keeps the run its own full span for the tooltip, whatever month it is drawn in', () => {
    const october = rowIn(build({ mountings: [GHOST] }), 'October 2026', 'Port 1-up')?.blocks[0];

    expect(october?.fullInterval).toEqual(GHOST.interval);
    expect(october?.nights).toBe(178);
  });

  it('leaves a row empty rather than inventing a state for it', () => {
    // I4: a gap means "not recorded", never "unavailable".
    expect(rowIn(build({ mountings: [GHOST] }), 'August 2026', 'Port 3')?.blocks).toEqual([]);
  });
});

describe('the legend', () => {
  it('lists only the instruments actually drawn, in a stable order', () => {
    const timeline = build({
      mountings: [
        mounting({ id: 'a', rowLabel: 'Port 3', instrument: 'GMOS', interval: span('2026-08-08', '2026-08-20') }),
        mounting({
          id: 'b',
          rowLabel: 'Port 1-up',
          instrument: 'GHOST',
          publishedName: 'GHOST',
          interval: span('2026-08-08', '2026-09-01'),
        }),
      ],
    });

    // Alphabetical rather than whichever port comes first, so the key does not
    // reshuffle between semesters. Ten instruments the sheet never mentions would
    // be keys to colours that are not on the page.
    expect(timeline.instruments).toEqual(['GHOST', 'GMOS']);
    expect(timeline.hasClosure).toBe(false);
    expect(timeline.hasUnscheduled).toBe(false);
  });

  it('treats a published ENGINEERING run as an instrument, because the sheet does', () => {
    const timeline = build({
      mountings: [
        mounting({
          id: 'eng',
          rowLabel: 'Port 3',
          instrument: 'ENGINEERING',
          publishedName: 'Engineering',
          interval: span('2026-10-05', '2026-10-09'),
        }),
      ],
    });

    expect(rowIn(timeline, 'October 2026', 'Port 3')?.blocks[0]?.state).toBe('MOUNTED');
    expect(timeline.instruments).toEqual(['ENGINEERING']);
  });

  it('flags an unscheduled span separately from the instruments', () => {
    const timeline = build({
      closures: [closure({ id: 'ag', port: 4, interval: span('2026-08-02', '2026-09-01'), reason: 'A&G' })],
    });

    expect(timeline.hasUnscheduled).toBe(true);
    expect(timeline.instruments).toEqual([]);
  });
});
