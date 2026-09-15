import { addDays, daysBetween } from './semester';
import type { PublishedSemester, Site } from './types';

export interface CoverageRange {
  readonly firstNight: string;
  readonly lastNight: string;
  readonly demo: boolean;
}

/** The site's semesters in date order - the one filter every reader of this list needs. */
export const semestersAtSite = (semesters: readonly PublishedSemester[], site: Site): readonly PublishedSemester[] =>
  semesters.filter((entry) => entry.site === site).sort((a, b) => a.firstNight.localeCompare(b.firstNight));

/** The semester whose nights contain this one, or null. Never the nearest: a night outside every
 *  semester is held by none, and a page reporting on it must not borrow another's demo flag. */
export const semesterHolding = (
  semesters: readonly PublishedSemester[],
  site: Site,
  observingNight: string,
): PublishedSemester | null =>
  semestersAtSite(semesters, site).find(
    (entry) => entry.firstNight <= observingNight && observingNight <= entry.lastNight,
  ) ?? null;

/** The site's published nights as merged ranges, in date order. */
export const coverageRanges = (semesters: readonly PublishedSemester[], site: Site): readonly CoverageRange[] => {
  const sorted = semestersAtSite(semesters, site).map(({ firstNight, lastNight, demo }) => ({
    firstNight,
    lastNight,
    demo,
  }));

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

/** Null when nothing is published, or when the night is already covered: there is no nearest then. */
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

/** One rule for every semester-reading surface; null only when the site has published nothing. */
export const resolveSemester = (
  semesters: readonly PublishedSemester[],
  site: Site,
  requested: string | null,
  observingNight: string,
): PublishedSemester | null => {
  const forSite = semestersAtSite(semesters, site);

  const byName = forSite.find((entry) => entry.semester === requested);
  if (byName !== undefined) {
    return byName;
  }

  const holding = semesterHolding(semesters, site, observingNight);
  if (holding !== null) {
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
