/**
 * Semester and observing-night date helpers.
 *
 * A Gemini semester is `<year><A|B>`: the A semester runs Feb 1 - Jul 31, the B
 * semester Aug 1 - Jan 31 of the following year. Observing nights are labelled by
 * the lucuma-core convention - the local date on which the night ends - so the set
 * of nights in a semester is the set of end-dates in that range.
 */

export interface SemesterId {
  readonly year: number;
  readonly half: 'A' | 'B';
}

const SEMESTER_RE = /^(\d{4})([AB])$/;

/** Parses a semester string such as "2026B"; returns null when malformed. */
export const parseSemester = (semester: string): SemesterId | null => {
  const match = SEMESTER_RE.exec(semester);
  if (match === null) {
    return null;
  }
  return { year: Number(match[1]), half: match[2] as 'A' | 'B' };
};

/** Formats a SemesterId back to its canonical string. */
export const formatSemester = (id: SemesterId): string => `${id.year}${id.half}`;

/** The semester before this one (2027A -> 2026B), or null when unparsable. */
export const previousSemester = (semester: string): string | null => {
  const id = parseSemester(semester);
  if (id === null) {
    return null;
  }
  return id.half === 'A' ? `${id.year - 1}B` : `${id.year}A`;
};

const pad = (value: number): string => value.toString().padStart(2, '0');

/** Short weekday labels indexed by JS `getUTCDay()`. */
export const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/** Short month labels indexed by JS `getUTCMonth()`. */
export const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

/** Formats a Date as an ISO calendar date (YYYY-MM-DD) in UTC. */
export const toIsoDate = (date: Date): string =>
  `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;

/** Parses an ISO calendar date (YYYY-MM-DD) as a UTC Date. */
export const fromIsoDate = (iso: string): Date => new Date(`${iso}T00:00:00Z`);

/** Adds a whole number of days to an ISO calendar date. */
export const addDays = (iso: string, days: number): string => {
  const date = fromIsoDate(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return toIsoDate(date);
};

/** Inclusive count of days between two ISO calendar dates. */
export const daysBetween = (startIso: string, endIso: string): number =>
  Math.round((fromIsoDate(endIso).getTime() - fromIsoDate(startIso).getTime()) / 86_400_000);

export interface DateRange {
  readonly start: string;
  readonly end: string;
}

/**
 * The inclusive observing-night date range of a semester. Nights are labelled by
 * the date they end, so the A semester's first night ends Feb 1 and its last ends
 * Jul 31; the B semester spans Aug 1 to Jan 31 of the next year.
 */
export const semesterNightRange = (semester: string): DateRange | null => {
  const id = parseSemester(semester);
  if (id === null) {
    return null;
  }
  if (id.half === 'A') {
    return { start: `${id.year}-02-01`, end: `${id.year}-07-31` };
  }
  return { start: `${id.year}-08-01`, end: `${id.year + 1}-01-31` };
};

/** Every observing-night date in a semester, in order. */
export const semesterNightDates = (semester: string): readonly string[] => {
  const range = semesterNightRange(semester);
  if (range === null) {
    return [];
  }
  const dates: string[] = [];
  for (let iso = range.start; iso <= range.end; iso = addDays(iso, 1)) {
    dates.push(iso);
  }
  return dates;
};

/** The seven observing-night dates of the week starting at `startIso`. */
export const weekNightDates = (startIso: string): readonly string[] =>
  Array.from({ length: 7 }, (_, index) => addDays(startIso, index));

/**
 * Clamps a window start so an N-night window stays inside the semester - the
 * URL's night selection may point at a different semester than the one chosen.
 * Identity when the semester is unparsable.
 */
export const clampWindowStart = (observingNight: string, semester: string, windowNights: number): string => {
  const range = semesterNightRange(semester);
  if (range === null) {
    return observingNight;
  }
  const lastStart = addDays(range.end, -(windowNights - 1));
  const maxStart = lastStart < range.start ? range.start : lastStart;
  if (observingNight < range.start) {
    return range.start;
  }
  return observingNight > maxStart ? maxStart : observingNight;
};
