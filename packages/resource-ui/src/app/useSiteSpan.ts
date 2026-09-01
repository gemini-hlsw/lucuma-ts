import { useSemester } from '@/app/useSemester';
import { observingNightInterval } from '@/domain/siteTime';
import { type ApiInterval, toApiInterval } from '@/gql/hooks';

export const useSiteSpan = (): ApiInterval | null => {
  // Already in date order and contiguous, so the ends of the list are the ends of the record.
  const { semestersForSite } = useSemester();
  const first = semestersForSite[0];
  const last = semestersForSite.at(-1);

  return first === undefined || last === undefined
    ? null
    : {
        // The site comes off the semesters, so the window and the nights it bounds name one site.
        start: toApiInterval(observingNightInterval(first.site, first.firstNight)).start,
        end: toApiInterval(observingNightInterval(last.site, last.lastNight)).end,
      };
};
