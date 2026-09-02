import { localDateTimeToUtc, SITE_TIME_ZONES as ZONES, zoneFormatters } from './localTime';
import { addDays } from './semester';
import type { Interval, Site } from './types';

export { zoneFormatters };

/** `satisfies` keeps it honest: a site added to the schema fails to compile until it has a zone. */
export const SITE_TIME_ZONES = ZONES satisfies Record<Site, string>;

/** Display only: observing-night labels and evening dates are the site's calendar and never move. */
export type TimeDisplay = 'site' | 'utc';

/** The IANA zone `display` names at `site` - what every clock formatter renders in. */
export const displayTimeZone = (site: Site, display: TimeDisplay): string =>
  display === 'utc' ? 'UTC' : SITE_TIME_ZONES[site];

/** The UTC epoch-millis instant of `hour:minute` local time on the given ISO date. */
/** The [start, end) UTC interval (epoch millis) of the observing night ending on `isoDate`. */
export const observingNightInterval = (site: Site, isoDate: string): Interval => ({
  start: localDateTimeToUtc(addDays(isoDate, -1), 14, 0, SITE_TIME_ZONES[site]),
  end: localDateTimeToUtc(isoDate, 14, 0, SITE_TIME_ZONES[site]),
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
  return Number(field('hour')) % 24 >= 14 ? addDays(localDate, 1) : localDate;
};

/** How the published sheet heads that night's column. */
export const firstEveningDate = (site: Site, interval: Interval): string =>
  addDays(observingNightOf(site, interval.start), -1);

/** Not symmetric with the start: an interval's end is exclusive and lands on the label date, a day late. */
export const lastEveningDate = (site: Site, interval: Interval): string =>
  addDays(observingNightOf(site, interval.end - 1), -1);

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
