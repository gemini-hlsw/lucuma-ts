import { describe, expect, it } from 'vitest';

import { buildFinderRows, historyOf, matchesComponent } from './componentFinder';
import { observingNightInterval } from './siteTime';
import type { ComponentBlock, ComponentRecord, Mounting } from './types';

const night = observingNightInterval('GS', '2026-10-15');

const piece = (over: Partial<ComponentRecord> = {}): ComponentRecord => ({
  id: 'k-gs-R400_G5325',
  instrument: 'GMOS',
  componentType: 'DISPERSER',
  code: 'R400_G5325',
  name: 'R400',
  barcode: null,
  aliases: ['R400'],
  ...over,
});

const block = (over: Partial<ComponentBlock> = {}): ComponentBlock => ({
  id: 'b1',
  componentId: 'k-gs-R400_G5325',
  usage: 'SCIENCE',
  location: 'INSTALLED',
  interval: { start: night.start - 30 * 86_400_000, end: night.end + 30 * 86_400_000 },
  note: null,
  ...over,
});

const mounting: Mounting = {
  id: 'm1',
  instrument: 'GMOS',
  publishedName: 'GMOS',
  usage: 'SCIENCE',
  port: 3,
  locationType: 'PORT',
  interval: { start: night.start - 60 * 86_400_000, end: night.end + 60 * 86_400_000 },
  note: null,
};

const rowsOf = (blocks: readonly ComponentBlock[], mountings: readonly Mounting[] = [mounting]) =>
  buildFinderRows({ components: [piece()], blocks, mountings, night });

describe('where a piece is', () => {
  it('resolves INSTALLED through the instrument, so the port comes from one source', () => {
    const [row] = rowsOf([block()]);

    expect(row?.where).toEqual({ kind: 'INSTALLED', port: 3, instrumentName: 'GMOS' });
    expect(row?.usage).toBe('SCIENCE');
  });

  it('names the storage place when the piece is not installed', () => {
    const [row] = rowsOf([block({ location: 'LAB', usage: 'UNAVAILABLE' })]);

    expect(row?.where).toEqual({ kind: 'STORED', location: 'LAB' });
  });

  it('says not recorded when no record covers the night - never unavailable', () => {
    // Invariant I4, surviving to the finder row.
    const [row] = rowsOf([]);

    expect(row?.where).toEqual({ kind: 'NOT_RECORDED' });
    expect(row?.usage).toBeNull();
  });

  it('reports where the piece ended up when it moves during the night', () => {
    const midnight = (night.start + night.end) / 2;
    const [row] = rowsOf([
      block({ id: 'a', interval: { start: night.start - 86_400_000, end: midnight } }),
      block({
        id: 'b',
        location: 'LAB',
        usage: 'UNAVAILABLE',
        note: 'Failed; removed for repair',
        interval: { start: midnight, end: night.end + 86_400_000 },
      }),
    ]);

    expect(row?.where).toEqual({ kind: 'STORED', location: 'LAB' });
    expect(row?.changesTonight).toBe(true);
    expect(row?.note).toBe('Failed; removed for repair');
  });
});

describe('when a piece changes tonight', () => {
  const midnight = (night.start + night.end) / 2;

  it('names the instant two abutting records meet, once', () => {
    const [row] = rowsOf([
      block({ id: 'a', interval: { start: night.start - 86_400_000, end: midnight } }),
      block({ id: 'b', location: 'LAB', interval: { start: midnight, end: night.end + 86_400_000 } }),
    ]);

    expect(row?.transitions).toEqual([midnight]);
  });

  it('names both edges of a gap - the record ending and the next beginning', () => {
    const off = midnight - 3_600_000;
    const on = midnight + 3_600_000;
    const [row] = rowsOf([
      block({ id: 'a', interval: { start: night.start - 86_400_000, end: off } }),
      block({ id: 'b', location: 'LAB', interval: { start: on, end: night.end + 86_400_000 } }),
    ]);

    expect(row?.transitions).toEqual([off, on]);
    expect(row?.changesTonight).toBe(true);
  });

  it('reports no transitions for one steady record', () => {
    const [row] = rowsOf([block()]);

    expect(row?.transitions).toEqual([]);
    expect(row?.changesTonight).toBe(false);
  });
});

describe('history', () => {
  it('lists a piece blocks oldest first, and only that piece', () => {
    const mine = [
      block({ id: 'later', interval: { start: night.start, end: night.end } }),
      block({ id: 'earlier', interval: { start: night.start - 86_400_000, end: night.start } }),
    ];
    const other = block({ id: 'other', componentId: 'k-gs-other' });

    expect(historyOf('k-gs-R400_G5325', [...mine, other]).map((entry) => entry.id)).toEqual(['earlier', 'later']);
  });
});

describe('search', () => {
  it('matches name, code, barcode and alias, case-insensitively', () => {
    const mask = piece({ id: 'mask', code: '11002801', name: 'Mask GS2026B-011', barcode: '11002801', aliases: [] });

    expect(matchesComponent(mask, 'gs2026b')).toBe(true);
    expect(matchesComponent(mask, '11002801')).toBe(true);
    expect(matchesComponent(piece(), 'r400')).toBe(true);
    expect(matchesComponent(mask, 'r400')).toBe(false);
  });

  it('matches everything on a blank search', () => {
    expect(matchesComponent(piece(), '  ')).toBe(true);
  });
});
