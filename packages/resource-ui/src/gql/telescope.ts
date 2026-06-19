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

export const TELESCOPE_MODE_STATUS_FRAGMENT = graphql(`
  fragment TelescopeModeStatusItem on TelescopeModeStatus {
    site
    interval {
      ...TimestampIntervalItem
    }
    mode {
      type
      programReference
    }
  }
`);

export const TELESCOPE_AVAILABILITY_STATUS_FRAGMENT = graphql(`
  fragment TelescopeAvailabilityStatusItem on TelescopeAvailabilityStatus {
    site
    interval {
      ...TimestampIntervalItem
    }
    availability
    reason
    plannedAvailability
  }
`);

export const TELESCOPE_TOO_STATUS_FRAGMENT = graphql(`
  fragment TelescopeTooStatusItem on TelescopeTooStatus {
    site
    interval {
      ...TimestampIntervalItem
    }
    tooSupport
  }
`);

export const TELESCOPE_NIGHT_TIMELINE_FRAGMENT = graphql(`
  fragment TelescopeNightTimelineItem on TelescopeNightTimeline {
    site
    observingNight
    displayInterval {
      ...TimestampIntervalItem
    }
    availability {
      ...TelescopeAvailabilityStatusItem
    }
    tooStatus {
      ...TelescopeTooStatusItem
    }
    modes {
      ...TelescopeModeStatusItem
    }
  }
`);

export const GET_TELESCOPE_NIGHT_TIMELINE = graphql(`
  query getTelescopeNightTimeline($site: Site!, $observingNight: Date!) {
    telescopeNightTimeline(site: $site, observingNight: $observingNight) {
      ...TelescopeNightTimelineItem
    }
  }
`);

export function useTelescopeNightTimeline(site: Site, observingNight: string) {
  return useQuery(GET_TELESCOPE_NIGHT_TIMELINE, {
    variables: { site, observingNight },
  });
}
