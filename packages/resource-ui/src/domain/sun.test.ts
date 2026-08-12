import { describe, expect, it } from 'vitest';

import { observingNightInterval } from './siteTime';
import { nightSunTimes } from './sun';

const HOUR = 3_600_000;

/** Hour-of-day (site-local, roughly) for sanity windows. */
const hstHour = (epochMillis: number): number => new Date(epochMillis - 10 * HOUR).getUTCHours();

describe('nightSunTimes', () => {
  it('finds an ordered sunset, dusk, dawn, sunrise for a Maunakea August night', () => {
    const night = observingNightInterval('GN', '2026-08-02');
    const sun = nightSunTimes('GN', night);

    expect(sun.sunset).not.toBeNull();
    expect(sun.duskAstronomical).not.toBeNull();
    expect(sun.dawnAstronomical).not.toBeNull();
    expect(sun.sunrise).not.toBeNull();
    // Strictly ordered within the night.
    expect(sun.sunset!).toBeLessThan(sun.duskAstronomical!);
    expect(sun.duskAstronomical!).toBeLessThan(sun.dawnAstronomical!);
    expect(sun.dawnAstronomical!).toBeLessThan(sun.sunrise!);
    // Early-August Maunakea: sunset around 19h HST, sunrise around 6h HST.
    expect(hstHour(sun.sunset!)).toBeGreaterThanOrEqual(18);
    expect(hstHour(sun.sunset!)).toBeLessThanOrEqual(19);
    expect(hstHour(sun.sunrise!)).toBeGreaterThanOrEqual(5);
    expect(hstHour(sun.sunrise!)).toBeLessThanOrEqual(6);
    // Astronomical darkness lasts a plausible tropical-summer stretch.
    const darknessHours = (sun.dawnAstronomical! - sun.duskAstronomical!) / HOUR;
    expect(darknessHours).toBeGreaterThan(7);
    expect(darknessHours).toBeLessThan(10);
  });

  it('gives Cerro Pachon a longer winter darkness in June', () => {
    const night = observingNightInterval('GS', '2027-06-15');
    const sun = nightSunTimes('GS', night);
    const darknessHours = (sun.dawnAstronomical! - sun.duskAstronomical!) / HOUR;
    expect(darknessHours).toBeGreaterThan(10);
    expect(darknessHours).toBeLessThan(13);
  });
});
