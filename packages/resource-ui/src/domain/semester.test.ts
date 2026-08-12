import { describe, expect, it } from 'vitest';

import { addDays, clampWindowStart, semesterNightDates, semesterNightRange, weekNightDates } from './semester';

describe('semesterNightRange', () => {
  it('runs Feb-Jul for an A semester', () => {
    expect(semesterNightRange('2026A')).toEqual({ start: '2026-02-01', end: '2026-07-31' });
  });

  it('runs Aug-Jan of the next year for a B semester', () => {
    expect(semesterNightRange('2026B')).toEqual({ start: '2026-08-01', end: '2027-01-31' });
  });

  it('returns null for a malformed semester', () => {
    expect(semesterNightRange('nope')).toBeNull();
  });
});

describe('semesterNightDates', () => {
  it('enumerates every night in order and spans the year boundary', () => {
    const dates = semesterNightDates('2026B');
    expect(dates[0]).toBe('2026-08-01');
    expect(dates.at(-1)).toBe('2027-01-31');
    expect(dates).toContain('2026-12-31');
    expect(dates).toContain('2027-01-01');
  });
});

describe('weekNightDates', () => {
  it('returns seven consecutive dates', () => {
    expect(weekNightDates('2026-08-01')).toEqual([
      '2026-08-01',
      '2026-08-02',
      '2026-08-03',
      '2026-08-04',
      '2026-08-05',
      '2026-08-06',
      '2026-08-07',
    ]);
  });
});

describe('addDays', () => {
  it('crosses month boundaries', () => {
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01');
  });
});

describe('clampWindowStart', () => {
  it('pulls a start from another semester into the selected one', () => {
    // The URL default (2026-08-01) with 2027A selected lands on the semester start.
    expect(clampWindowStart('2026-08-01', '2027A', 14)).toBe('2027-02-01');
  });

  it('keeps a full window inside the semester end', () => {
    expect(clampWindowStart('2027-07-30', '2027A', 14)).toBe('2027-07-18');
  });

  it('is the identity inside the semester or for an unparsable one', () => {
    expect(clampWindowStart('2027-04-10', '2027A', 14)).toBe('2027-04-10');
    expect(clampWindowStart('2026-08-01', 'garbage', 14)).toBe('2026-08-01');
  });
});
