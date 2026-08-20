/**
 * Sunset, sunrise, and astronomical-twilight times for an observing night -
 * display context for the night chart (when darkness actually starts and ends),
 * not an ephemeris. NOAA-style solar-position approximation, good to a couple
 * of minutes; crossings are found by a minute-step scan over the night, which
 * is robust at every latitude the observatory cares about.
 */
import type { Interval, Site } from './types';

const SITE_COORDINATES: Record<Site, { latDeg: number; lonDeg: number }> = {
  GN: { latDeg: 19.8238, lonDeg: -155.4689 }, // Maunakea
  GS: { latDeg: -30.2407, lonDeg: -70.7366 }, // Cerro Pachon
};

const RAD = Math.PI / 180;

/** Solar altitude in degrees at an instant, for a location. */
export const solarAltitude = (epochMillis: number, latDeg: number, lonDeg: number): number => {
  const days = epochMillis / 86_400_000 + 2_440_587.5 - 2_451_545.0;
  const meanAnomaly = RAD * (357.529 + 0.985_600_28 * days);
  const meanLongitude = 280.459 + 0.985_647_36 * days;
  const eclipticLongitude = RAD * (meanLongitude + 1.915 * Math.sin(meanAnomaly) + 0.02 * Math.sin(2 * meanAnomaly));
  const obliquity = RAD * (23.439 - 0.000_000_36 * days);
  const rightAscension = Math.atan2(Math.cos(obliquity) * Math.sin(eclipticLongitude), Math.cos(eclipticLongitude));
  const declination = Math.asin(Math.sin(obliquity) * Math.sin(eclipticLongitude));
  const siderealHours = 18.697_374_558 + 24.065_709_824_419_08 * days;
  const localSiderealDeg = ((siderealHours % 24) * 15 + lonDeg + 360 * 4) % 360;
  const hourAngle = RAD * localSiderealDeg - rightAscension;
  const lat = RAD * latDeg;
  const altitude = Math.asin(
    Math.sin(lat) * Math.sin(declination) + Math.cos(lat) * Math.cos(declination) * Math.cos(hourAngle),
  );
  return altitude / RAD;
};

/** Sun refraction horizon and the astronomical-darkness threshold, in degrees. */
const HORIZON_DEG = -0.833;
const ASTRONOMICAL_DEG = -18;

export interface NightSunTimes {
  /** Sun crosses the horizon going down; null if it never does in the night. */
  readonly sunset: number | null;
  /** Astronomical darkness begins (sun below -18 deg). */
  readonly duskAstronomical: number | null;
  /** Astronomical darkness ends. */
  readonly dawnAstronomical: number | null;
  /** Sun crosses the horizon going up. */
  readonly sunrise: number | null;
}

const STEP_MS = 60_000;

/** Scans the night for the four crossings. */
export const nightSunTimes = (site: Site, night: Interval): NightSunTimes => {
  const { latDeg, lonDeg } = SITE_COORDINATES[site];
  let sunset: number | null = null;
  let dusk: number | null = null;
  let dawn: number | null = null;
  let sunrise: number | null = null;

  let previous = solarAltitude(night.start, latDeg, lonDeg);
  for (let t = night.start + STEP_MS; t <= night.end; t += STEP_MS) {
    const altitude = solarAltitude(t, latDeg, lonDeg);
    if (sunset === null && previous >= HORIZON_DEG && altitude < HORIZON_DEG) {
      sunset = t;
    }
    if (dusk === null && previous >= ASTRONOMICAL_DEG && altitude < ASTRONOMICAL_DEG) {
      dusk = t;
    }
    if (dawn === null && previous < ASTRONOMICAL_DEG && altitude >= ASTRONOMICAL_DEG) {
      dawn = t;
    }
    if (sunrise === null && previous < HORIZON_DEG && altitude >= HORIZON_DEG) {
      sunrise = t;
    }
    previous = altitude;
  }
  return { sunset, duskAstronomical: dusk, dawnAstronomical: dawn, sunrise };
};
