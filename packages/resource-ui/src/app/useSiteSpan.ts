/**
 * The interval covering everything a site has ever recorded.
 *
 * The inventory browsers are **site-scoped, not semester-scoped** (Dan,
 * 2026-08-12). "Where is Zorro" is not a semester question: Zorro sits out GS
 * 2025B and `Alopeke sits out two GN semesters, so a browser cut at the
 * semester boundary answers with silence. A piece's history does not restart in
 * February either - the R400's failure spans the 2025B/2026A boundary, and half
 * a run is worse than none, because nothing on screen says it was cut.
 *
 * The masthead's semester control still moves the **night** these pages report
 * for; it just no longer decides what they can see.
 *
 * Null while the semester list is loading, or when the site has published
 * nothing at all.
 */
import { useSemester } from '@/app/useSemester';
import type { ApiInterval } from '@/gql/hooks';

export const useSiteSpan = (): ApiInterval | null => {
  // `semestersForSite` is already in date order and the semesters are
  // contiguous, so the ends of the list are the ends of the record.
  const { semestersForSite } = useSemester();
  const first = semestersForSite[0];
  const last = semestersForSite.at(-1);

  return first === undefined || last === undefined
    ? null
    : { start: `${first.firstNight}T00:00:00.000Z`, end: `${last.lastNight}T23:59:59.999Z` };
};
