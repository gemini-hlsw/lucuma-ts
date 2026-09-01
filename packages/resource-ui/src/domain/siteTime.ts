import type { Interval, Site } from './types';

/** Each site's IANA zone - the one map every zone-aware formatter reads. */
export const SITE_TIME_ZONES = {
  GN: 'Pacific/Honolulu',
  GS: 'America/Santiago',
} satisfies Record<Site, string>;

/** Display only: observing-night labels and evening dates are the site's calendar and never move. */
export type TimeDisplay = 'site' | 'utc';

/** The IANA zone `display` names at `site` - what every clock formatter renders in. */
export const displayTimeZone = (site: Site, display: TimeDisplay): string =>
  display === 'utc' ? 'UTC' : SITE_TIME_ZONES[site];

/** Construction is expensive and the label formatters run per block, so cache one per zone. */
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

/** The site-local date at that instant, advanced one day at or after 14:00 local. */
export const observingNightOf = (site: Site, epochMillis: number): string => {
  const parts = nightParts(SITE_TIME_ZONES[site]).formatToParts(new Date(epochMillis));
  const field = (type: string): string => parts.find((part) => part.type === type)?.value ?? '';
  const localDate = `${field('year')}-${field('month')}-${field('day')}`;
  return Number(field('hour')) % 24 >= 14 ? addDaysIso(localDate, 1) : localDate;
};

/** How the published sheet heads that night's column. */
export const firstEveningDate = (site: Site, interval: Interval): string =>
  addDaysIso(observingNightOf(site, interval.start), -1);

/** Not symmetric with the start: an interval's end is exclusive and lands on the label date, a day late. */
export const lastEveningDate = (site: Site, interval: Interval): string =>
  addDaysIso(observingNightOf(site, interval.end - 1), -1);

const DAY_MS = 24 * 60 * 60 * 1000;

/** Counted over evening dates, not elapsed hours: a night is 23 or 25 hours across a GS DST change. */
export const nightCount = (site: Site, interval: Interval): number => {
  const first = Date.parse(`${firstEveningDate(site, interval)}T00:00:00Z`);
  const last = Date.parse(`${lastEveningDate(site, interval)}T00:00:00Z`);
  return Math.round((last - first) / DAY_MS) + 1;
};

/** The choice is about what the page around it already says, never about what the date means. */
export type EveningStyle =
  /** "7 Aug" - a chart tooltip, where the year is the window's own. */
  | 'dayMonth'
  /** "7 Aug 2026" - a table spanning a site's whole record, where it is not. */
  | 'dayMonthYear'
  /** "Sat 21 Nov" - a week card, which is read by weekday. */
  | 'weekdayDayMonth';

const EVENING_OPTIONS = {
  dayMonth: { day: 'numeric', month: 'short' },
  dayMonthYear: { day: 'numeric', month: 'short', year: 'numeric' },
  weekdayDayMonth: { weekday: 'short', day: 'numeric', month: 'short' },
} satisfies Record<EveningStyle, Intl.DateTimeFormatOptions>;

const eveningFormatters = new Map<EveningStyle, Intl.DateTimeFormat>();

/** Formatted at midday UTC, in UTC, so a plain calendar date cannot slide a day under anybody's zone. */
export const eveningLabel = (eveningDate: string, style: EveningStyle = 'dayMonthYear'): string => {
  let formatter = eveningFormatters.get(style);
  if (formatter === undefined) {
    formatter = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', ...EVENING_OPTIONS[style] });
    eveningFormatters.set(style, formatter);
  }
  return formatter.format(new Date(`${eveningDate}T12:00:00Z`));
};

/** An en dash with spaces, the same one in every table that prints a record's extent. */
export const eveningRange = (site: Site, interval: Interval, style: EveningStyle = 'dayMonthYear'): string =>
  `${eveningLabel(firstEveningDate(site, interval), style)} – ${eveningLabel(lastEveningDate(site, interval), style)}`;
