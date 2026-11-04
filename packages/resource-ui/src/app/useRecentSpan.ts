import type { ScheduleSpan } from '@gql/types';

import { useSelection } from '@/app/useSelection';
import { toScheduleSpan } from '@/domain/adapters';
import { DAY_MS, observingNightInterval } from '@/domain/siteTime';

/** The longest window the Resource service accepts. */
export const RECENT_DAYS = 400;

export const useRecentSpan = (): ScheduleSpan => {
  const { site, tonight } = useSelection();
  const end = observingNightInterval(site, tonight).end;

  return toScheduleSpan({ start: end - RECENT_DAYS * DAY_MS, end });
};
