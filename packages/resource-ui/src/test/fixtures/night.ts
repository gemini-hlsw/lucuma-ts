import type { MockedResponseOf } from '@gemini-hlsw/lucuma-common-ui/testing';
import type { NightScheduleQuery, NightScheduleQueryVariables, Site } from '@gql/gen/graphql';
import { NIGHT_SCHEDULE_QUERY } from '@gql/resource';

import { overNights } from './blocks';

export interface NightRow {
  readonly site: Site;
  readonly night: string;
}

/** The window the page asks for: the observing night itself. */
export const nightWindow = ({ site, night }: NightRow): NightScheduleQueryVariables => {
  const { start, end } = overNights(site, night, night);
  return { site, night, start, end };
};

type NightBlocks = Partial<Omit<NightScheduleQuery, 'telescopeNight'>> & {
  /** False is the backend saying it holds nothing for the night, which no empty list can say. */
  readonly dataAvailable?: boolean;
};

/** Pass a night to answer the window its page asks for, or explicit variables to pin that window. */
export const nightSchedule = (
  window: NightRow | NightScheduleQueryVariables,
  { dataAvailable = true, ...blocks }: NightBlocks = {},
): MockedResponseOf<typeof NIGHT_SCHEDULE_QUERY> => {
  const variables = 'start' in window ? window : nightWindow(window);
  return {
    request: { query: NIGHT_SCHEDULE_QUERY, variables },
    result: {
      data: {
        telescopeNight: {
          __typename: 'TelescopeNight',
          observingNight: variables.night,
          dataAvailable,
          interval: { __typename: 'TimestampInterval', start: variables.start, end: variables.end },
        },
        instrumentAvailability: [],
        telescopeAvailability: [],
        tooSupport: [],
        telescopeMode: [],
        telescopeSubsystemAvailability: [],
        ...blocks,
      },
    },
  };
};
