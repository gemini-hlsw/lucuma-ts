import { describe, expect, it } from 'vitest';

import { coversNight } from './interval';

const NIGHT = { start: 100, end: 200 };

describe(coversNight, () => {
  it('is true for an interval matching the night exactly', () => {
    expect(coversNight({ start: 100, end: 200 }, NIGHT)).toBe(true);
  });

  it('is true for a multi-night block clipped to this night', () => {
    // Stored blocks span nights; the night view asks whether one covers this one.
    expect(coversNight({ start: 0, end: 500 }, NIGHT)).toBe(true);
  });

  it('is false when either end leaves part of the night uncovered', () => {
    expect(coversNight({ start: 120, end: 200 }, NIGHT)).toBe(false);
    expect(coversNight({ start: 100, end: 180 }, NIGHT)).toBe(false);
    expect(coversNight({ start: 120, end: 180 }, NIGHT)).toBe(false);
  });

  it('is false for an interval that misses the night entirely', () => {
    expect(coversNight({ start: 0, end: 50 }, NIGHT)).toBe(false);
  });
});
