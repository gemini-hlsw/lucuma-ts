import type { MockedResponseOf } from '@gemini-hlsw/lucuma-common-ui/testing';
import type { Site, WeekScheduleQuery, WeekScheduleQueryVariables } from '@gql/gen/graphql';
import { WEEK_SCHEDULE_QUERY } from '@gql/resource';

import { addDays } from '@/domain/semester';

import { overNights } from './blocks';

export interface WeekRow {
  readonly site: Site;
  /** The first observing night of the seven, as the URL's `night` names it. */
  readonly night: string;
}

const WEEK_NIGHTS = 7;

/** The window the page asks for: seven observing nights, the date range half-open. */
export const weekWindow = ({ site, night }: WeekRow): WeekScheduleQueryVariables => {
  const { start, end } = overNights(site, night, addDays(night, WEEK_NIGHTS - 1));
  return { site, nights: { start: night, end: addDays(night, WEEK_NIGHTS) }, interval: { start, end } };
};

type WeekBlocks = Partial<Omit<WeekScheduleQuery, 'telescopeNights'>> & {
  /** The nights the backend holds nothing for; every other night of the seven has data. */
  readonly withoutData?: readonly string[];
};

export const weekSchedule = (
  week: WeekRow,
  { withoutData = [], ...blocks }: WeekBlocks = {},
): MockedResponseOf<typeof WEEK_SCHEDULE_QUERY> => ({
  request: { query: WEEK_SCHEDULE_QUERY, variables: weekWindow(week) },
  result: {
    data: {
      telescopeNights: Array.from({ length: WEEK_NIGHTS }, (_, index) => {
        const observingNight = addDays(week.night, index);
        return { __typename: 'TelescopeNight', observingNight, dataAvailable: !withoutData.includes(observingNight) };
      }),
      instrumentAvailability: [],
      telescopeAvailability: [],
      instrumentComponentAvailability: [],
      tooSupport: [],
      telescopeMode: [],
      ...blocks,
    },
  },
});
