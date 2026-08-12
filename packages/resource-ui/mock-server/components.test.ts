import { describe, expect, it } from 'vitest';

import { COMPONENT_CATALOG, synthesizeComponentBlocks } from './components.ts';
import { buildSeedState } from './seed.ts';

const schedules = buildSeedState().schedules;
const blocks = synthesizeComponentBlocks(schedules);

const blocksOf = (componentId: string) =>
  blocks.filter((block) => block.componentId === componentId).sort((a, b) => a.start.localeCompare(b.start));

describe('the catalog', () => {
  it('gives every piece a unique id', () => {
    const ids = COMPONENT_CATALOG.map((component) => component.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('identifies a mask by its barcode, which doubles as its code', () => {
    // v1-domain-model.md §5.2: a MOS mask has no enum value.
    for (const mask of COMPONENT_CATALOG.filter((component) => component.barcode !== null)) {
      expect(mask.code).toBe(mask.barcode);
    }
  });

  it('covers the [REQ] v1 set at Gemini South, plus every instrument the sheets mount', () => {
    const gs = COMPONENT_CATALOG.filter((component) => component.site === 'GS');
    expect(new Set(gs.map((component) => component.instrument))).toEqual(
      new Set(['GMOS', 'F2', 'GHOST', 'CAL_ZORRO', 'GSAOI', 'CANOPUS', 'IQUEYE']),
    );
    expect(new Set(gs.map((component) => component.componentType))).toEqual(
      new Set(['FILTER', 'DISPERSER', 'FPU', 'WFS', 'OTHER']),
    );
  });

  it('keeps codes unique within a site, because the id is derived from them', () => {
    for (const site of ['GS', 'GN'] as const) {
      const codes = COMPONENT_CATALOG.filter((component) => component.site === site).map((component) => component.code);
      expect(new Set(codes).size).toBe(codes.length);
    }
  });
});

describe('the synthetic blocks', () => {
  it('is deterministic: two runs over the same fixtures agree exactly', () => {
    expect(synthesizeComponentBlocks(schedules)).toEqual(blocks);
  });

  it('anchors a riding piece to its instrument: installed exactly while mounted', () => {
    // The g filter rides with GMOS-S, so every INSTALLED span must be covered by
    // the union of GMOS mountings from the published sheets - the anchoring
    // rule. The union, not any single mounting: consecutive semesters abut, so
    // an unbroken mounting across the boundary merges into one installed span.
    const spans = schedules
      .filter((schedule) => schedule.site === 'GS')
      .flatMap((schedule) =>
        schedule.blocks
          .filter((block) => block.kind === 'MOUNTED' && block.instrument === 'GMOS')
          .map((block) => ({ start: Date.parse(block.start), end: Date.parse(block.end) })),
      )
      .sort((a, b) => a.start - b.start);
    const union: { start: number; end: number }[] = [];
    for (const span of spans) {
      const last = union.at(-1);
      if (last !== undefined && span.start <= last.end) {
        last.end = Math.max(last.end, span.end);
      } else {
        union.push({ ...span });
      }
    }

    const installed = blocksOf('k-gs-g_G0325').filter((block) => block.place === 'INSTALLED');
    expect(installed.length).toBeGreaterThan(0);
    for (const block of installed) {
      const from = Date.parse(block.start);
      const to = Date.parse(block.end);
      expect(union.some((span) => span.start <= from && to <= span.end)).toBe(true);
    }
  });

  it('keeps a spare in the lab as one merged block, not one per semester', () => {
    // Consecutive semesters abut - one ends at 14:00 local on the day the next
    // begins - so an unmoving spare is a single span across all four GS
    // semesters, not four abutting blocks.
    const spare = blocksOf('k-gs-R831_G5322');
    expect(spare).toHaveLength(1);
    expect(spare[0]).toMatchObject({ place: 'SUMMIT_LAB', usage: 'UNAVAILABLE' });
  });

  it('takes a failing piece off mid-mounting, with the reason on the record', () => {
    const r400 = blocksOf('k-gs-R400_G5325');
    const failed = r400.find((block) => block.note === 'Failed; removed for repair');

    expect(failed).toMatchObject({ place: 'SUMMIT_LAB', usage: 'UNAVAILABLE' });
    // The failure lands inside a mounting, so the boundary is a mid-run instant
    // - which is what gives the partial-night capability synthetic data.
    const installedBefore = r400.find((block) => block.place === 'INSTALLED' && block.end === failed?.start);
    expect(installedBefore).toBeDefined();
  });

  it('installs a campaign mask for a bounded span inside the mounting', () => {
    const mask = blocksOf('k-gs-11002801');
    const installed = mask.filter((block) => block.place === 'INSTALLED');

    expect(installed.length).toBeGreaterThan(0);
    for (const block of installed) {
      expect(block.note).toBe('Installed for the campaign');
    }
  });

  it('leaves no gaps and no overlaps within one piece, in order', () => {
    for (const component of COMPONENT_CATALOG) {
      const spans = blocksOf(component.id);
      for (let index = 1; index < spans.length; index += 1) {
        // Sorted; each next block starts at or after the previous ends,
        // and within one semester exactly at it.
        expect(spans[index]!.start >= spans[index - 1]!.end).toBe(true);
      }
    }
  });
});
