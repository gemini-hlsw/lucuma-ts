/**
 * Site-local time math for the frontend.
 *
 * An observing night ending on local date D runs 14:00 local on D-1 to 14:00 local
 * on D (the lucuma-core LocalObservingNight convention). This module resolves night
 * intervals, night labels and evening dates from that boundary, correct across DST
 * at Gemini South. It uses `Intl` for the offset; the real backend uses lucuma-core.
 * It mirrors `mock-server/time.ts` deliberately, so a night the UI derives and a
 * night the mock derives share the same 14:00 boundary.
 */
import type { Interval, Site } from './types';

/** Each site's IANA zone - the one map every zone-aware formatter reads. */
export const SITE_TIME_ZONES = {
  GN: 'Pacific/Honolulu',
  GS: 'America/Santiago',
} satisfies Record<Site, string>;

/**
 * Which clock the UI renders instants in: the site's own wall clock, or UT.
 * A masthead choice (the `clock` URL parameter), read by every clock-time
 * formatter. Display only - observing-night labels and evening dates are the
 * site's calendar and never move with it.
 */
export type TimeDisplay = 'site' | 'utc';

/** The IANA zone `display` names at `site` - what every clock formatter renders in. */
export const displayTimeZone = (site: Site, display: TimeDisplay): string =>
  display === 'utc' ? 'UTC' : SITE_TIME_ZONES[site];

/**
 * One `Intl.DateTimeFormat` per zone for a fixed locale and options.
 *
 * Construction is expensive and the label formatters run per block and per
 * tooltip, so each call site holds one cached formatter per zone - and only
 * three zones ever occur: the two sites' and UTC.
 */
export const zoneFormatters = (
  locale: string,
  options: Intl.DateTimeFormatOptions,
): ((timeZone: string) => Intl.DateTimeFormat) => {
  const cache = new Map<string, Intl.DateTimeFormat>();
  return (timeZone) => {
    let formatter = cache.get(timeZone);
    if (formatter === undefined) {
      formatter = new Intl.DateTimeFormat(locale, { ...options, timeZone });
      cache.set(timeZone, formatter);
    }
    return formatter;
  };
};

const pad = (value: number): string => value.toString().padStart(2, '0');

const addDaysIso = (isoDate: string, days: number): string => {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const offsetParts = zoneFormatters('en-US', {
  hour12: false,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

/** Minutes that `timeZone` is offset from UTC at the given instant. */
const offsetMinutes = (instant: Date, timeZone: string): number => {
  const parts = offsetParts(timeZone).formatToParts(instant);
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

/** The UTC epoch-millis instant of `hour:minute` local time on the given ISO date. */
const localDateTimeToUtc = (isoDate: string, hour: number, minute: number, site: Site): number => {
  const timeZone = SITE_TIME_ZONES[site];
  const guess = Date.parse(`${isoDate}T${pad(hour)}:${pad(minute)}:00Z`);
  let instant = guess;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const adjusted = guess - offsetMinutes(new Date(instant), timeZone) * 60_000;
    if (adjusted === instant) {
      return instant;
    }
    instant = adjusted;
  }
  return instant;
};

/** The [start, end) UTC interval (epoch millis) of the observing night ending on `isoDate`. */
export const observingNightInterval = (site: Site, isoDate: string): Interval => ({
  start: localDateTimeToUtc(addDaysIso(isoDate, -1), 14, 0, site),
  end: localDateTimeToUtc(isoDate, 14, 0, site),
});

const nightParts = zoneFormatters('en-CA', {
  hour12: false,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
});

/**
 * The observing night containing the instant, as its ISO label: the site-local
 * date at that instant, advanced one day at or after 14:00 local (the night that
 * evening opens is labelled by the morning it ends on).
 */
export const observingNightOf = (site: Site, epochMillis: number): string => {
  const parts = nightParts(SITE_TIME_ZONES[site]).formatToParts(new Date(epochMillis));
  const field = (type: string): string => parts.find((part) => part.type === type)?.value ?? '';
  const localDate = `${field('year')}-${field('month')}-${field('day')}`;
  return Number(field('hour')) % 24 >= 14 ? addDaysIso(localDate, 1) : localDate;
};

/**
 * The evening date of the **first** observing night an interval covers, which is
 * how the published sheet heads that night's column.
 */
export const firstEveningDate = (site: Site, interval: Interval): string =>
  addDaysIso(observingNightOf(site, interval.start), -1);

/**
 * The evening date of the **last** observing night an interval covers.
 *
 * Not symmetric with the start, and that asymmetry is the trap. An interval's end
 * is exclusive and lands at 14:00 on the last night's *label* date, so naming the
 * calendar date at `end - 1 hour` reports the label rather than the evening and is
 * a day late - which is how a run ending on the sheet's "31" column came out as
 * "1 Feb".
 *
 * Nor can a fixed offset fix it: a night is 23 or 25 hours across a DST change at
 * Gemini South, so any constant is wrong twice a year. The night is resolved
 * first, then its evening derived, which is exact at every boundary.
 */
export const lastEveningDate = (site: Site, interval: Interval): string =>
  addDaysIso(observingNightOf(site, interval.end - 1), -1);

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * How many observing nights an interval covers, both ends included.
 *
 * Counted over the evening dates rather than the elapsed hours, because a night
 * is 23 or 25 hours across a DST change at Gemini South - dividing the interval
 * by a day would drop or invent a night twice a year. Evening dates are plain
 * calendar dates, so differencing them at UTC midnight is exact.
 */
export const nightCount = (site: Site, interval: Interval): number => {
  const first = Date.parse(`${firstEveningDate(site, interval)}T00:00:00Z`);
  const last = Date.parse(`${lastEveningDate(site, interval)}T00:00:00Z`);
  return Math.round((last - first) / DAY_MS) + 1;
};
