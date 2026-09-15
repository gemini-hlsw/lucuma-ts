import { useSelection } from '@/app/useSelection';
import { useUrlParam } from '@/app/useUrlParam';
import { resolveSemester, semestersAtSite } from '@/domain/coverage';
import type { PublishedSemester } from '@/domain/types';
import { usePublishedSemesters } from '@/gql/hooks';

interface SemesterSelection {
  /** The semester to show. Null only while the list is loading or empty. */
  readonly semester: PublishedSemester | null;
  readonly semestersForSite: readonly PublishedSemester[];
  readonly setSemester: (semester: string) => void;
  readonly loading: boolean;
  readonly error: Error | undefined;
}

/**
 * The semester page's own selection: navigation drops the param at the boundary
 * (`app/carriedSelection.ts`), and a pasted `?semester=` elsewhere is simply unread. Nothing
 * outside /semester may call this.
 */
export function useSemester(): SemesterSelection {
  const { site, observingNight } = useSelection();
  // The month names a page of one semester's calendar, so it cannot survive a semester change.
  const [requested, setSemester] = useUrlParam('semester', '', { clears: ['month'] });
  const { semesters, loading, error } = usePublishedSemesters();

  return {
    semester: resolveSemester(semesters, site, requested === '' ? null : requested, observingNight),
    semestersForSite: semestersAtSite(semesters, site),
    setSemester,
    loading,
    error,
  };
}
