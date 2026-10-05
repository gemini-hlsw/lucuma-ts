import { useSelection } from '@/app/useSelection';
import { DAY_MS, observingNightInterval } from '@/domain/siteTime';
import { type ApiInterval, toApiInterval } from '@/gql/hooks';

/** The longest window the Resource service accepts. */
export const RECENT_DAYS = 400;

export const useRecentSpan = (): ApiInterval => {
  const { site, tonight } = useSelection();
  const end = observingNightInterval(site, tonight).end;

  return toApiInterval({ start: end - RECENT_DAYS * DAY_MS, end });
};
