import { useQuery } from '@apollo/client/react';

import { graphql } from './gen';
import type { Site } from './gen/graphql';

export const TIME_SPAN_FRAGMENT = graphql(`
  fragment TimeSpanItem on TimeSpan {
    iso
    seconds
  }
`);

export const TIMESTAMP_INTERVAL_FRAGMENT = graphql(`
  fragment TimestampIntervalItem on TimestampInterval {
    start
    end
    duration {
      ...TimeSpanItem
    }
  }
`);

export const GET_TELESCOPE_NIGHT_TIMELINE = graphql(`
  query getTelescopeNightTimeline($site: Site!, $observingNight: Date!) {
    telescopeNightTimeline(site: $site, observingNight: $observingNight) {
      site
      observingNight
      displayInterval {
        ...TimestampIntervalItem
      }
      availability {
        interval {
          ...TimestampIntervalItem
        }
        availability
        reason
        plannedAvailability
        site
      }
      tooStatus {
        interval {
          ...TimestampIntervalItem
        }
        tooSupport
        site
      }
      modes {
        interval {
          ...TimestampIntervalItem
        }
        site
        mode {
          type
          programReference
        }
      }
    }
  }
`);

export function useTelescopeNightTimeline(site: Site, observingNight: string) {
  return useQuery(GET_TELESCOPE_NIGHT_TIMELINE, {
    variables: {
      site,
      observingNight,
    },
  });
}
