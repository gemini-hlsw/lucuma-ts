import { describe, expect, it } from 'vitest';

import { overlaps } from './interval';
import { observingNightInterval } from './siteTime';

/** The window a finder asks its records about. */
const night = observingNightInterval('GS', '2026-10-15');
const HOUR = 3_600_000;

describe(overlaps, () => {
  it('leaves out a record that ends exactly where the night begins', () => {
    // Half-open [start, end): the closing instant belongs to the next record, so it cannot count for both.
    const ended = { start: night.start - 12 * HOUR, end: night.start };

    expect(overlaps(ended, night)).toBe(false);
  });

  it('leaves out a record that begins exactly where the night ends', () => {
    const next = { start: night.end, end: night.end + 12 * HOUR };

    expect(overlaps(next, night)).toBe(false);
  });

  it('takes a record that reaches one millisecond into the night', () => {
    const reaching = { start: night.start - 12 * HOUR, end: night.start + 1 };

    expect(overlaps(reaching, night)).toBe(true);
  });

  it('takes a record that begins one millisecond before the night ends', () => {
    const arriving = { start: night.end - 1, end: night.end + 12 * HOUR };

    expect(overlaps(arriving, night)).toBe(true);
  });

  it('takes a record wholly inside the night, and a night wholly inside a record', () => {
    const inside = { start: night.start + 6 * HOUR, end: night.start + 9 * HOUR };
    const around = { start: night.start - 30 * 24 * HOUR, end: night.end + 30 * 24 * HOUR };

    expect(overlaps(inside, night)).toBe(true);
    expect(overlaps(around, night)).toBe(true);
  });

  it('leaves out a record on another night entirely', () => {
    const elsewhere = observingNightInterval('GS', '2026-10-20');

    expect(overlaps(elsewhere, night)).toBe(false);
    expect(overlaps(night, elsewhere)).toBe(false);
  });
});
