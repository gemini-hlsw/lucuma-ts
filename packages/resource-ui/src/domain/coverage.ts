/**
 * What the published semesters cover at a site, said out loud.
 *
 * The no-data night message uses this: a dead end that only says "no schedule
 * covers this night" leaves the reader to guess what is covered and to type
 * dates until one lands. Contiguous semesters merge into one span - 2025A
 * through 2026B is one unbroken run of nights - and a demo semester never
 * merges with a real one, so a synthetic range is always its own entry and can
 * be labelled as such.
 */
import { addDays, daysBetween } from './semester';
import type { PublishedSemester, Site } from './types';

export interface CoverageRange {
  readonly firstNight: string;
  readonly lastNight: string;
  readonly demo: boolean;
}

/** The site's published nights as merged ranges, in date order. */
export const coverageRanges = (semesters: readonly PublishedSemester[], site: Site): readonly CoverageRange[] => {
  const sorted = semesters
    .filter((entry) => entry.site === site)
    .map(({ firstNight, lastNight, demo }) => ({ firstNight, lastNight, demo }))
    .sort((a, b) => a.firstNight.localeCompare(b.firstNight));

  const ranges: CoverageRange[] = [];
  for (const range of sorted) {
    const previous = ranges.at(-1);
    // Adjacent counts as contiguous: semester B starts the night after A ends.
    if (previous?.demo === range.demo && range.firstNight <= addDays(previous.lastNight, 1)) {
      if (range.lastNight > previous.lastNight) {
        ranges[ranges.length - 1] = { ...previous, lastNight: range.lastNight };
      }
    } else {
      ranges.push(range);
    }
  }
  return ranges;
};

/**
 * The covered night closest to the one asked for.
 *
 * Null when nothing is published, or when the night is already inside a range -
 * there is no "nearest" to offer then, and the caller is not on the no-data
 * path in the first place.
 */
export const nearestCoveredNight = (ranges: readonly CoverageRange[], observingNight: string): string | null => {
  let best: { readonly night: string; readonly distance: number } | null = null;
  for (const range of ranges) {
    if (range.firstNight <= observingNight && observingNight <= range.lastNight) {
      return null;
    }
    const night = observingNight < range.firstNight ? range.firstNight : range.lastNight;
    const distance = Math.abs(daysBetween(observingNight, night));
    if (best === null || distance < best.distance) {
      best = { night, distance };
    }
  }
  return best?.night ?? null;
};

/**
 * The semester every semester-reading surface agrees to show.
 *
 * The masthead control and the pages behind it must never disagree, go blank,
 * or fall back to an arbitrary list entry - which is exactly what a stale
 * link, a site switch, or Tonight walking past the workbook's edge used to
 * cause. One rule, shared:
 *
 * 1. An explicit request that names a semester the site holds wins - a
 *    /semester link means the semester it says.
 * 2. Otherwise the semester holding the current night - the control follows
 *    the night, so Tonight lands where the night is.
 * 3. Otherwise the semester nearest the night, so a night beyond every
 *    semester still shows the closest thing to it rather than nothing.
 * 4. Null only when the site has no semesters at all - before data arrives.
 */
export const resolveSemester = (
  semesters: readonly PublishedSemester[],
  site: Site,
  requested: string | null,
  observingNight: string,
): PublishedSemester | null => {
  const forSite = semesters
    .filter((entry) => entry.site === site)
    .sort((a, b) => a.firstNight.localeCompare(b.firstNight));

  const byName = forSite.find((entry) => entry.semester === requested);
  if (byName !== undefined) {
    return byName;
  }

  const holding = forSite.find((entry) => entry.firstNight <= observingNight && observingNight <= entry.lastNight);
  if (holding !== undefined) {
    return holding;
  }

  let best: { readonly entry: PublishedSemester; readonly distance: number } | null = null;
  for (const entry of forSite) {
    const edge = observingNight < entry.firstNight ? entry.firstNight : entry.lastNight;
    const distance = Math.abs(daysBetween(observingNight, edge));
    if (best === null || distance < best.distance) {
      best = { entry, distance };
    }
  }
  return best?.entry ?? null;
};
