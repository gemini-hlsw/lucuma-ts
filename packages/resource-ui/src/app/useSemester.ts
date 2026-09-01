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
