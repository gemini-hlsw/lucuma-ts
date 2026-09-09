import { CURRENT_ENV } from '@/auth/environments';

/** Explore is the science UI PIs use; the Admin views link program references
 *  to it so a reviewer can jump straight to the program (sc-10159 items 1-2).
 *  A program reference label ("G-2026B-0298-P") is the path. The origin comes
 *  from the running environment, so admin-dev links to the dev Explore rather
 *  than sending a reviewer to a production program. */
export function exploreProgramUrl(referenceLabel: string): string {
  // Encoded rather than interpolated raw: reference labels are ODB-assigned and
  // URL-safe today, but nothing in the type system says they must stay that way.
  return `${CURRENT_ENV.exploreUri}/${encodeURIComponent(referenceLabel)}`;
}
