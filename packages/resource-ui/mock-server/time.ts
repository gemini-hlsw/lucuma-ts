import { localDateTimeToUtc, SITE_TIME_ZONES } from '../src/domain/localTime.ts';

type MockSite = keyof typeof SITE_TIME_ZONES;

/** `isoDate` moved by whole days, staying on the calendar. */
export const addDaysIso = (isoDate: string, days: number): string => {
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
    start: new Date(localDateTimeToUtc(addDaysIso(isoDate, -1), 14, 0, timeZone)).toISOString(),
    end: new Date(localDateTimeToUtc(isoDate, 14, 0, timeZone)).toISOString(),
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
