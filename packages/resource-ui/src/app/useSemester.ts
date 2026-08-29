/**
 * The resolved semester selection - the one reading of "which semester" that
 * the masthead control and every semester-reading page share.
 *
 * The URL carries a raw request (`useSelection().semester`); this hook holds
 * it against the published data and returns a real semester or null-while-
 * loading, per the rule in `domain/coverage.ts` `resolveSemester`. Pages must
 * not resolve for themselves: the last private fallback (`?? semesters[0]`)
 * had the masthead blank on a stale name while the page quietly showed the
 * oldest semester in the list.
 */
import { useSelection } from '@/app/useSelection';
import { resolveSemester } from '@/domain/coverage';
import type { PublishedSemester } from '@/domain/types';
import { usePublishedSemesters } from '@/gql/hooks';

interface ResolvedSemester {
  /** The semester to show. Null only while the list is loading or empty. */
  readonly semester: PublishedSemester | null;
  /** For the masthead's options. */
  readonly semestersForSite: readonly PublishedSemester[];
  readonly loading: boolean;
  readonly error: Error | undefined;
}

export function useSemester(): ResolvedSemester {
  const { site, semester: requested, observingNight } = useSelection();
  const { semesters, loading, error } = usePublishedSemesters();

  const semestersForSite = semesters
    .filter((entry) => entry.site === site)
    .sort((a, b) => a.firstNight.localeCompare(b.firstNight));

  return {
    semester: resolveSemester(semesters, site, requested, observingNight),
    semestersForSite,
    loading,
    error,
  };
}
