import { addDays } from '@/domain/semester';
import { eveningLabel, observingNightOf } from '@/domain/siteTime';
import type { Site } from '@/domain/types';

import { overNights } from './blocks';
import { publishedSemester, type PublishedSemesterRow } from './semester';

/** The finder pages answer for tonight alone, so their fixtures are placed relative to it. */
export const nightFromTonight = (site: Site, days: number): string => addDays(observingNightOf(site, Date.now()), days);

export const nightsFromTonight = (site: Site, first: number, last: number) =>
  overNights(site, nightFromTonight(site, first), nightFromTonight(site, last));

/** How a history row phrases `nightsFromTonight(site, first, last)`: the evenings those nights begin. */
export const eveningsFromTonight = (site: Site, first: number, last: number): string =>
  `${eveningLabel(nightFromTonight(site, first - 1))} - ${eveningLabel(nightFromTonight(site, last - 1))}`;

/** A runs February to July, B August to January, named by the year B starts. */
const semesterOf = (night: string): string => {
  const [year = 0, month = 0] = night.split('-').map(Number);
  if (month >= 2 && month <= 7) {
    return `${year}A`;
  }
  return month === 1 ? `${year - 1}B` : `${year}B`;
};

export const semesterFromTonight = (
  site: Site,
  first: number,
  last: number,
  overrides: Partial<Omit<PublishedSemesterRow, '__typename' | 'site' | 'nights'>> = {},
): PublishedSemesterRow =>
  publishedSemester({
    site,
    semester: semesterOf(nightFromTonight(site, first)),
    nights: {
      __typename: 'DateInterval',
      start: nightFromTonight(site, first),
      end: nightFromTonight(site, last + 1),
    },
    ...overrides,
  });
