/**
 * Observing-night date arithmetic, on ISO calendar dates read as UTC.
 *
 * Nights are labelled by the lucuma-core convention - the local date on which
 * the night ends - so stepping between nights is plain date arithmetic and never
 * a timezone question. A semester's own bounds are not computed here: the API
 * publishes each one's first and last night on `PublishedSemester`, and every
 * view reads them from there.
 */

const pad = (value: number): string => value.toString().padStart(2, '0');

/** Formats a Date as an ISO calendar date (YYYY-MM-DD) in UTC. */
const toIsoDate = (date: Date): string =>
  `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;

/** Parses an ISO calendar date (YYYY-MM-DD) as a UTC Date. */
const fromIsoDate = (iso: string): Date => new Date(`${iso}T00:00:00Z`);

/** Adds a whole number of days to an ISO calendar date. */
export const addDays = (iso: string, days: number): string => {
  const date = fromIsoDate(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return toIsoDate(date);
};

/** Inclusive count of days between two ISO calendar dates. */
export const daysBetween = (startIso: string, endIso: string): number =>
  Math.round((fromIsoDate(endIso).getTime() - fromIsoDate(startIso).getTime()) / 86_400_000);
