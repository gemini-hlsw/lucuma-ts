import { describe, expect, it } from 'vitest';

import { buildSeedState } from './seed.ts';
import { synthesizeStoredInstruments } from './storedInstruments.ts';

const schedules = buildSeedState().schedules;
const blocks = synthesizeStoredInstruments(schedules);

describe(synthesizeStoredInstruments, () => {
  it('holds the lucuma-core instruments the workbook never schedules', () => {
    expect(new Set(blocks.map((block) => block.instrument))).toEqual(new Set(['ACQ_CAM', 'NIRI', 'GPI', 'SCORPIO']));
  });

  it('never puts a stored instrument on a port - that is what keeps it off the charts', () => {
    // `OffPortPlace` makes `place` structurally unable to be PORT; this asserts what is actually served.
    for (const block of blocks) {
      expect(['FLOOR', 'LAB', 'BASE', 'UNKNOWN']).toContain(block.place);
    }
  });

  it('fixes each instrument to one site - instruments do not move between telescopes', () => {
    // AcqCam is the exception in shape, not in fact: one enum tag per telescope, the way GMOS is.
    const sites = new Map<string, Set<string>>();
    for (const block of blocks) {
      sites.set(block.instrument, (sites.get(block.instrument) ?? new Set()).add(block.site));
    }
    expect([...(sites.get('NIRI') ?? [])]).toEqual(['GN']);
    expect([...(sites.get('GPI') ?? [])]).toEqual(['GS']);
    expect([...(sites.get('SCORPIO') ?? [])]).toEqual(['GS']);
    expect([...(sites.get('ACQ_CAM') ?? [])].sort()).toEqual(['GN', 'GS']);
  });

  it('moves an instrument between places over time, which is the point of it', () => {
    const niri = blocks.filter((block) => block.instrument === 'NIRI').sort((a, b) => a.start.localeCompare(b.start));

    expect(niri.map((block) => block.place)).toEqual(['LAB', 'FLOOR', 'LAB']);
    // Abutting exactly: one stay ends where the next begins, no gap, no overlap.
    for (const [index, block] of niri.slice(1).entries()) {
      expect(block.start).toBe(niri[index]?.end);
    }
  });

  it('stays inside the site window, so no night gets a location the schedule knows nothing about', () => {
    // Mountings and closures alike: GS opens 2024B shut, and that shutdown is as much a record as a run.
    const span = (site: string) => {
      const edges = schedules
        .filter((schedule) => schedule.site === site)
        .flatMap((schedule) => [...schedule.blocks, ...schedule.closures])
        .flatMap((record) => [record.start, record.end])
        .sort();
      return { first: edges[0] ?? '', last: edges.at(-1) ?? '' };
    };
    for (const block of blocks) {
      const { first, last } = span(block.site);
      expect(block.start >= first).toBe(true);
      expect(block.end <= last).toBe(true);
    }
  });

  it('is deterministic - the same schedules give the same records', () => {
    expect(synthesizeStoredInstruments(schedules)).toEqual(blocks);
  });
});
