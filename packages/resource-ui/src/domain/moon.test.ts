import { describe, expect, it } from 'vitest';

import { moonPhaseAt, moonPhaseLabel, SYNODIC_DAYS } from './moon';

const DAY_MS = 86_400_000;
// The reference new moon the module is anchored to.
const NEW_MOON = Date.UTC(2000, 0, 6, 18, 14);

describe('moonPhaseAt', () => {
  it('is dark and waxing at the reference new moon', () => {
    const phase = moonPhaseAt(NEW_MOON);
    expect(phase.age).toBeCloseTo(0, 5);
    expect(phase.fraction).toBeCloseTo(0, 5);
    expect(phase.waxing).toBe(true);
  });

  it('is fully illuminated half a synodic month later', () => {
    const phase = moonPhaseAt(NEW_MOON + (SYNODIC_DAYS / 2) * DAY_MS);
    expect(phase.fraction).toBeCloseTo(1, 5);
  });

  it('is half illuminated at the quarters, waxing then waning', () => {
    const first = moonPhaseAt(NEW_MOON + (SYNODIC_DAYS / 4) * DAY_MS);
    expect(first.fraction).toBeCloseTo(0.5, 5);
    expect(first.waxing).toBe(true);

    const last = moonPhaseAt(NEW_MOON + ((SYNODIC_DAYS * 3) / 4) * DAY_MS);
    expect(last.fraction).toBeCloseTo(0.5, 5);
    expect(last.waxing).toBe(false);
  });

  it('wraps correctly for instants before the reference epoch', () => {
    const phase = moonPhaseAt(NEW_MOON - SYNODIC_DAYS * DAY_MS);
    expect(phase.fraction).toBeCloseTo(0, 5);
  });

  it('stays close to a known ephemeris full moon (2026-01-03)', () => {
    // True full moon 2026-01-03 10:03 UTC; the mean cycle should be nearly full there.
    const phase = moonPhaseAt(Date.UTC(2026, 0, 3, 10, 3));
    expect(phase.fraction).toBeGreaterThan(0.98);
  });
});

describe('moonPhaseLabel', () => {
  it('names the principal phases with an illumination percentage', () => {
    expect(moonPhaseLabel(moonPhaseAt(NEW_MOON))).toBe('New moon, 0% illuminated');
    expect(moonPhaseLabel(moonPhaseAt(NEW_MOON + (SYNODIC_DAYS / 2) * DAY_MS))).toBe('Full moon, 100% illuminated');
    expect(moonPhaseLabel(moonPhaseAt(NEW_MOON + (SYNODIC_DAYS / 4) * DAY_MS))).toContain('First quarter');
    expect(moonPhaseLabel(moonPhaseAt(NEW_MOON + SYNODIC_DAYS * 0.6 * DAY_MS))).toContain('Waning gibbous');
  });
});
