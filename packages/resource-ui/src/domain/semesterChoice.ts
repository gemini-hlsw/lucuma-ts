import { daysBetween } from './semester';
import type { PublishedSemester, Site } from './types';

/** The site's semesters in date order - the one filter every reader of this list needs. */
export const semestersAtSite = (semesters: readonly PublishedSemester[], site: Site): readonly PublishedSemester[] =>
  semesters.filter((entry) => entry.site === site).sort((a, b) => a.firstNight.localeCompare(b.firstNight));

/** The Semester page's one rule for which semester to show; null only when the site has published nothing. */
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
