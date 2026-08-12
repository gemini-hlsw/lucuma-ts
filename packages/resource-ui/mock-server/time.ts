/**
 * Observing-night interval helper for the mock.
 *
 * An observing night ending on local date D runs from 14:00 local on D-1 to 14:00
 * local on D (the lucuma-core LocalObservingNight convention). The real backend
 * uses lucuma-core; the mock computes the site-local 14:00 boundary via Intl so it
 * is correct across DST at Gemini South.
 */

const SITE_TIME_ZONES = {
  GN: 'Pacific/Honolulu',
  GS: 'America/Santiago',
} as const;

type MockSite = keyof typeof SITE_TIME_ZONES;

/** Minutes that `timeZone` is offset from UTC at the given instant. */
const offsetMinutes = (instant: Date, timeZone: string): number => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant);
  const field = (type: string): number => Number(parts.find((part) => part.type === type)?.value);
  const asUtc = Date.UTC(
    field('year'),
    field('month') - 1,
    field('day'),
    field('hour') % 24,
    field('minute'),
    field('second'),
  );
  return Math.round((asUtc - instant.getTime()) / 60_000);
};

/** The UTC instant of `hour:00` local time on the given ISO date, as epoch millis. */
const localHourToUtc = (isoDate: string, hour: number, timeZone: string): number => {
  const guess = Date.parse(`${isoDate}T${hour.toString().padStart(2, '0')}:00:00Z`);
  const offset = offsetMinutes(new Date(guess), timeZone);
  return guess - offset * 60_000;
};

const addDaysIso = (isoDate: string, days: number): string => {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

export interface MockInterval {
  start: string;
  end: string;
}

/** The [start, end) UTC interval of the observing night ending on `isoDate`. */
export const observingNightInterval = (site: MockSite, isoDate: string): MockInterval => {
  const timeZone = SITE_TIME_ZONES[site];
  return {
    start: new Date(localHourToUtc(addDaysIso(isoDate, -1), 14, timeZone)).toISOString(),
    end: new Date(localHourToUtc(isoDate, 14, timeZone)).toISOString(),
  };
};

/** True when [aStart, aEnd) and [bStart, bEnd) overlap. Open (null) ends run to +infinity. */
export const intervalsOverlap = (aStart: string, aEnd: string | null, bStart: string, bEnd: string): boolean => {
  const aEndMs = aEnd === null ? Infinity : Date.parse(aEnd);
  return Date.parse(aStart) < Date.parse(bEnd) && aEndMs > Date.parse(bStart);
};

/** Clips [start, end) to the bounds, returning null when there is no overlap. */
export const clipInterval = (interval: MockInterval, bounds: MockInterval): MockInterval | null => {
  const start = Math.max(Date.parse(interval.start), Date.parse(bounds.start));
  const end = Math.min(Date.parse(interval.end), Date.parse(bounds.end));
  if (start >= end) {
    return null;
  }
  return { start: new Date(start).toISOString(), end: new Date(end).toISOString() };
};
