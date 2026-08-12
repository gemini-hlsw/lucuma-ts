import { describe, expect, it } from 'vitest';

import { isoToLocalDate, localDateToIso } from './localDate';

describe('local date conversions', () => {
  it('round-trips an ISO date without a zone shift', () => {
    // The bug this guards: a UTC-midnight Date displays as the previous day in
    // any zone west of Greenwich, so a Calendar control would show 2026-07-31.
    for (const iso of ['2026-01-01', '2026-07-31', '2026-08-01', '2026-12-31', '2027-02-28']) {
      expect(localDateToIso(isoToLocalDate(iso))).toBe(iso);
    }
  });

  it('builds a Date on the browser calendar, not on UTC', () => {
    const date = isoToLocalDate('2026-08-01');
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(7);
    expect(date.getDate()).toBe(1);
  });

  it('zero-pads month and day so the result is always a sortable ISO date', () => {
    expect(localDateToIso(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});
