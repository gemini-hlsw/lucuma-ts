import { describe, expect, it } from 'vitest';

import { buildSemesterCells } from './semesterCells';
import { buildSemesterTimeline } from './semesterTimeline';
import { observingNightInterval } from './siteTime';
import type { Closure, Mounting } from './types';

/**
 * Built through `buildSemesterTimeline` rather than from hand-made rows, so
 * these pin the whole path from records to cells. That path is the point: the
 * module this replaces made its own cells from records and drifted away from the
 * chart on every one of the three cases below, silently, because nothing here
 * covered them.
 */

const SITE = 'GS' as const;

/** A span covering whole observing nights, inclusive of both. */
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

const closure = (over: Partial<Closure> = {}): Closure => ({
  id: 'c1',
  availability: 'CLOSED',
  port: 4,
  interval: nights('2026-08-08', '2026-08-14'),
  reason: 'A&G',
  ...over,
});

const build = (over: Partial<Parameters<typeof buildSemesterTimeline>[0]> = {}) => {
  const timeline = buildSemesterTimeline({
    site: SITE,
    firstNight: '2026-08-08',
    lastNight: '2026-08-14',
    mountings: [mounting()],
    closures: [closure()],
    ...over,
  });
  const month = timeline.months[0];
  if (month === undefined) {
    throw new Error('expected a month');
  }
  return buildSemesterCells({ rows: month.rows, nights: month.nights });
};

const row = (rows: ReturnType<typeof build>, label: string) => {
  const found = rows.find((candidate) => candidate.label === label);
  if (found === undefined) {
    throw new Error(`no row ${label}`);
  }
  return found;
};

describe('buildSemesterCells', () => {
  it('heads each cell with the evening the night begins, as the sheet does', () => {
    // The night labelled the 8th begins the evening of the 7th.
    expect(row(build(), 'Port 3').cells[0]).toMatchObject({
      observingNight: '2026-08-08',
      eveningDate: '2026-08-07',
    });
  });

  it('names the instrument on a mounted night, so colour can follow identity', () => {
    expect(row(build(), 'Port 3').cells[0]).toMatchObject({ kind: 'MOUNTED', instrument: 'GMOS', label: 'GMOS' });
  });

  it('marks a night with nothing recorded empty, never unavailable', () => {
    const rows = build({ mountings: [], closures: [] });
    expect(row(rows, 'Port 3').cells.map((cell) => cell.kind)).toEqual(Array<string>(7).fill('EMPTY'));
  });
});

/**
 * The three ways the superseded grid disagreed with the chart. Each is a fact
 * about `timeline.ts`; the value of asserting it here is that a future cell
 * projection cannot quietly stop using it.
 */
describe('what the superseded grid got wrong', () => {
  it('states a telescope-wide closure once, on the Telescope row, never repainting the ports', () => {
    // The consistent shutdown treatment (Dan, 2026-08-11): the Telescope row's
    // cells carry the red and the phrase; the port rows keep their own records
    // - the sheet's own empty cells during a shutdown - under the view's wash.
    const rows = build({
      closures: [
        closure({ id: 'wide', port: null, reason: 'Telescope Shutdown A&G Maintenance' }),
        // What the sheet actually spells down the port rows, one word each.
        closure({ id: 'p3', port: 3, reason: 'Shutdown' }),
        closure({ id: 'p4', port: 4, reason: 'Maintenance' }),
      ],
      mountings: [],
    });

    const telescope = row(rows, 'Telescope').cells;
    expect(telescope.map((cell) => cell.kind)).toEqual(Array<string>(7).fill('CLOSED'));
    expect(telescope[0]?.label).toBe('Closed');
    for (const label of ['Port 3', 'Port 4']) {
      expect(row(rows, label).cells.map((cell) => cell.kind)).toEqual(Array<string>(7).fill('EMPTY'));
    }
  });

  it('leaves no fragment behind on a port closure that only coincides with the shutdown', () => {
    const rows = build({
      closures: [
        closure({ id: 'wide', port: null, interval: nights('2026-08-08', '2026-08-10'), reason: 'Telescope Shutdown' }),
        closure({ id: 'p3', port: 3, interval: nights('2026-08-08', '2026-08-10'), reason: 'Telescope' }),
      ],
      mountings: [],
    });

    // "Telescope" was never a fact about Port 3, so nothing of it survives the
    // wide span's subtraction - every night is unrecorded, never closed.
    const labels = row(rows, 'Port 3').cells.map((cell) => cell.label);
    expect(labels).not.toContain('Telescope');
    expect(row(rows, 'Port 3').cells.map((cell) => cell.kind)).toEqual(Array<string>(7).fill('EMPTY'));
  });

  it('draws A&G as an absence, not as a shutdown', () => {
    // A&G outlasts any band and is genuinely about Port 4, so it survives - but
    // as UNSCHEDULED. Painting it CLOSED asserts a six-month failure the sheet
    // gives no evidence for (the A&G question, still open with operations).
    const cells = row(build(), 'Port 4').cells;
    expect(cells.map((cell) => cell.kind)).toEqual(Array<string>(7).fill('UNSCHEDULED'));
    expect(cells[0]).toMatchObject({ label: 'A&G', instrument: null });
  });
});

describe('the telescope-state rows', () => {
  const tooBlock = { id: 't1', tooSupport: 'NONE' as const, interval: nights('2026-08-08', '2026-08-14'), note: null };
  const modeBlock = {
    id: 'mode1',
    mode: 'CLASSICAL' as const,
    programReferences: ['G-2026B-0001-C'],
    partner: null,
    interval: nights('2026-08-08', '2026-08-14'),
    note: null,
  };

  it('projects a recorded state as a STATE cell, notable when it should catch the eye', () => {
    const rows = build({ tooBlocks: [tooBlock], modeBlocks: [modeBlock] });

    expect(row(rows, 'Mode').cells[0]).toMatchObject({ kind: 'STATE', label: 'Classical', notable: true });
    // With standard support the norm, a night ToOs cannot fire is the notable one.
    expect(row(rows, 'ToO').cells[0]).toMatchObject({ kind: 'STATE', label: 'No ToOs', notable: true });
  });

  it('projects the Telescope row: Open as a quiet state, Closed as the closure with its reason', () => {
    const rows = build({
      mountings: [],
      closures: [
        { id: 'a1', availability: 'OPEN', port: null, interval: nights('2026-08-08', '2026-08-10'), reason: null },
        {
          id: 'a2',
          availability: 'CLOSED',
          port: null,
          interval: nights('2026-08-11', '2026-08-14'),
          reason: 'Shutdown',
        },
      ],
    });
    const telescope = row(rows, 'Telescope').cells;

    expect(telescope[0]).toMatchObject({ kind: 'STATE', label: 'Open', notable: false });
    // "Closed", not the reason: the wash band's label carries the reason, so
    // the two never print the same phrase side by side.
    expect(telescope[4]).toMatchObject({ kind: 'CLOSED', label: 'Closed' });
  });

  it('keeps every other row on its own record under a telescope-wide closure', () => {
    // The closure does not erase the recorded ToO support, and a port with
    // nothing recorded stays a gap (I4) - the Telescope row alone reads closed.
    const rows = build({
      closures: [closure({ id: 'wide', port: null, reason: 'Shutdown' })],
      mountings: [],
      tooBlocks: [tooBlock],
    });

    expect(row(rows, 'Telescope').cells.map((cell) => cell.kind)).toEqual(Array<string>(7).fill('CLOSED'));
    expect(row(rows, 'Port 3').cells.map((cell) => cell.kind)).toEqual(Array<string>(7).fill('EMPTY'));
    expect(row(rows, 'ToO').cells.map((cell) => cell.kind)).toEqual(Array<string>(7).fill('STATE'));
  });
});

describe('nights that are not uniform', () => {
  it('marks a night holding two blocks as mixed rather than picking one', () => {
    const night = observingNightInterval(SITE, '2026-08-08');
    const midnight = (night.start + night.end) / 2;
    const rows = build({
      firstNight: '2026-08-08',
      lastNight: '2026-08-08',
      mountings: [
        mounting({ id: 'a', interval: { start: night.start, end: midnight } }),
        mounting({
          id: 'b',
          instrument: 'GHOST',
          publishedName: 'GHOST',
          interval: { start: midnight, end: night.end },
        }),
      ],
      closures: [],
    });

    expect(row(rows, 'Port 3').cells[0]).toMatchObject({ kind: 'MIXED', instrument: null });
  });

  it('marks a night a block covers only part of as mixed', () => {
    const night = observingNightInterval(SITE, '2026-08-08');
    const rows = build({
      firstNight: '2026-08-08',
      lastNight: '2026-08-08',
      mountings: [mounting({ interval: { start: night.start, end: (night.start + night.end) / 2 } })],
      closures: [],
    });

    expect(row(rows, 'Port 3').cells[0]?.kind).toBe('MIXED');
  });
});

describe('runs and labels', () => {
  it('labels a run once, at its start, and measures how far it reaches', () => {
    const cells = row(build(), 'Port 3').cells;
    expect(cells[0]).toMatchObject({ startsRun: true, runLength: 7 });
    expect(cells.slice(1).every((cell) => !cell.startsRun)).toBe(true);
  });

  it('breaks a run when the instrument changes', () => {
    const rows = build({
      mountings: [
        mounting({ id: 'a', interval: nights('2026-08-08', '2026-08-10') }),
        mounting({
          id: 'b',
          instrument: 'GHOST',
          publishedName: 'GHOST',
          interval: nights('2026-08-11', '2026-08-14'),
        }),
      ],
      closures: [],
    });

    const heads = row(rows, 'Port 3').cells.filter((cell) => cell.startsRun);
    expect(heads.map((cell) => [cell.label, cell.runLength])).toEqual([
      ['GMOS', 3],
      ['GHOST', 4],
    ]);
  });

  it('lets a short run borrow the blank nights after it, but not the next label', () => {
    const rows = build({
      mountings: [
        mounting({ id: 'a', interval: nights('2026-08-08', '2026-08-09') }),
        mounting({
          id: 'b',
          instrument: 'GHOST',
          publishedName: 'GHOST',
          interval: nights('2026-08-13', '2026-08-14'),
        }),
      ],
      closures: [],
    });

    const heads = row(rows, 'Port 3').cells.filter((cell) => cell.startsRun);
    // GMOS runs two nights, then three unlabelled ones it may spill over.
    expect(heads[0]).toMatchObject({ label: 'GMOS', runLength: 2, labelSpan: 5 });
    // GHOST is last, so its span is only its own.
    expect(heads.at(-1)).toMatchObject({ label: 'GHOST', runLength: 2, labelSpan: 2 });
  });

  it('gives every cell a sentence a screen reader can read', () => {
    const cells = row(build(), 'Port 4').cells;
    // "beginning": the sentence names the evening the column heads, and "night
    // of" stays the end-labelled name the click-through opens.
    expect(cells[0]?.description).toBe('Port 4: no instrument scheduled - A&G, night beginning 2026-08-07');
  });
});
