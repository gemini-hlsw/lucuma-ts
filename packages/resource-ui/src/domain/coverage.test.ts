/**
 * Coverage ranges and the nearest covered night, for the no-data night message.
 */
import { describe, expect, it } from 'vitest';

import { coverageRanges, nearestCoveredNight, resolveSemester } from './coverage';
import type { PublishedSemester } from './types';

const semester = (
  over: Partial<PublishedSemester> & Pick<PublishedSemester, 'semester' | 'firstNight' | 'lastNight'>,
): PublishedSemester => ({
  site: 'GS',
  title: over.semester,
  version: null,
  rowLabels: [],
  holidays: [],
  moonEvents: [],
  demo: false,
  ...over,
});

const GS = [
  semester({ semester: '2025A', firstNight: '2025-02-02', lastNight: '2025-08-01' }),
  semester({ semester: '2025B', firstNight: '2025-08-02', lastNight: '2026-02-01' }),
  semester({ semester: '2026B', firstNight: '2026-08-02', lastNight: '2027-02-01' }),
  semester({ semester: '2099B', firstNight: '2099-08-02', lastNight: '2100-02-01', demo: true }),
];

describe('coverageRanges', () => {
  it('merges adjacent semesters into one unbroken run of nights', () => {
    // 2025B starts the night after 2025A ends; 2026B stands alone (no 2026A here).
    expect(coverageRanges(GS, 'GS')).toEqual([
      { firstNight: '2025-02-02', lastNight: '2026-02-01', demo: false },
      { firstNight: '2026-08-02', lastNight: '2027-02-01', demo: false },
      { firstNight: '2099-08-02', lastNight: '2100-02-01', demo: true },
    ]);
  });

  it('never merges a demo semester into a real range', () => {
    const abutting = [
      semester({ semester: '2026B', firstNight: '2026-08-02', lastNight: '2027-02-01' }),
      semester({ semester: '2027A', firstNight: '2027-02-02', lastNight: '2027-08-01', demo: true }),
    ];

    // Synthetic nights must stay a separately labelled range even when the
    // dates would merge - a demo must never pass as published coverage.
    expect(coverageRanges(abutting, 'GS')).toHaveLength(2);
  });

  it('keeps sites apart', () => {
    expect(coverageRanges(GS, 'GN')).toEqual([]);
  });
});

describe('nearestCoveredNight', () => {
  const ranges = coverageRanges(GS, 'GS');

  it('offers the last covered night to someone past the end of a range', () => {
    // 2030 is years from 2027 and decades from 2099: the real range wins.
    expect(nearestCoveredNight(ranges, '2030-01-01')).toBe('2027-02-01');
  });

  it('offers the first covered night to someone before the start', () => {
    expect(nearestCoveredNight(ranges, '2024-01-01')).toBe('2025-02-02');
  });

  it('picks the nearer edge inside a gap', () => {
    // The gap between 2026-02-01 and 2026-08-02: March is nearer the left edge.
    expect(nearestCoveredNight(ranges, '2026-03-01')).toBe('2026-02-01');
    expect(nearestCoveredNight(ranges, '2026-07-20')).toBe('2026-08-02');
  });

  it('has nothing to offer when the night is already covered, or nothing is', () => {
    expect(nearestCoveredNight(ranges, '2025-06-01')).toBeNull();
    expect(nearestCoveredNight([], '2025-06-01')).toBeNull();
  });
});

describe('resolveSemester', () => {
  it('honours an explicit request that names a semester the site holds', () => {
    // Even when the night sits in a different semester: a /semester link means
    // the semester it says.
    expect(resolveSemester(GS, 'GS', '2025A', '2025-11-14')?.semester).toBe('2025A');
  });

  it('follows the night when the request is absent or names nothing the site holds', () => {
    expect(resolveSemester(GS, 'GS', null, '2025-11-14')?.semester).toBe('2025B');
    // The stale name a link can carry - a removed demo, another site's semester.
    expect(resolveSemester(GS, 'GS', '2031A', '2025-11-14')?.semester).toBe('2025B');
  });

  it('lands on the nearest semester when the night is beyond every one of them', () => {
    // Tonight walking past the data's edge must not blank the control: a night
    // after 2026B's end resolves to 2026B, one before 2025A to 2025A.
    expect(resolveSemester(GS, 'GS', null, '2027-06-15')?.semester).toBe('2026B');
    expect(resolveSemester(GS, 'GS', null, '2024-06-15')?.semester).toBe('2025A');
    // Inside the 2026A hole: 2026-05-01 is 89 nights from 2025B's end and 93
    // from 2026B's start, so the earlier semester is genuinely nearer.
    expect(resolveSemester(GS, 'GS', null, '2026-05-01')?.semester).toBe('2025B');
    expect(resolveSemester(GS, 'GS', null, '2026-07-01')?.semester).toBe('2026B');
  });

  it('never answers with another site, and is null only when the site holds nothing', () => {
    expect(resolveSemester(GS, 'GN', '2025B', '2025-11-14')).toBeNull();
    expect(resolveSemester([], 'GS', '2025B', '2025-11-14')).toBeNull();
  });
});
