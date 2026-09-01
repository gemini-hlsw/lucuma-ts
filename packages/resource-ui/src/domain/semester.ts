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

/** Count of days between two ISO calendar dates, exclusive of the start: the same date gives 0. */
export const daysBetween = (startIso: string, endIso: string): number =>
  Math.round((fromIsoDate(endIso).getTime() - fromIsoDate(startIso).getTime()) / 86_400_000);
