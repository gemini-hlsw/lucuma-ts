import { addDays } from '@/domain/semester';
import { eveningLabel, observingNightOf } from '@/domain/siteTime';
import type { Site } from '@/domain/types';

import { overNights } from './blocks';

/** The finder pages answer for tonight alone, so their fixtures are placed relative to it. */
export const nightFromTonight = (site: Site, days: number): string => addDays(observingNightOf(site, Date.now()), days);

export const nightsFromTonight = (site: Site, first: number, last: number) =>
  overNights(site, nightFromTonight(site, first), nightFromTonight(site, last));

/** How a history row phrases `nightsFromTonight(site, first, last)`: the evenings those nights begin. */
export const eveningsFromTonight = (site: Site, first: number, last: number): string =>
  `${eveningLabel(nightFromTonight(site, first - 1))} - ${eveningLabel(nightFromTonight(site, last - 1))}`;
