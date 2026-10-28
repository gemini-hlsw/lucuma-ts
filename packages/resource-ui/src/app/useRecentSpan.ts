import { useSelection } from '@/app/useSelection';
import { type ApiInterval, toApiInterval } from '@/domain/adapters';
import { DAY_MS, observingNightInterval } from '@/domain/siteTime';

/** The longest window the Resource service accepts. */
export const RECENT_DAYS = 400;

export const useRecentSpan = (): ApiInterval => {
  const { site, tonight } = useSelection();
  const end = observingNightInterval(site, tonight).end;

  return toApiInterval({ start: end - RECENT_DAYS * DAY_MS, end });
};
