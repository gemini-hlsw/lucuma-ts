import { useQuery } from '@apollo/client/react';

import { graphql } from './gen';
import type { Site } from './gen/graphql';

export const GET_TELESCOPE_NIGHT_TIMELINE = graphql(`
  query getTelescopeNightTimeline($site: Site!, $observingNight: Date!) {
    telescopeNightTimeline(site: $site, observingNight: $observingNight) {
      site
      observingNight
      displayInterval {
        start
        end
      }
      availability {
        interval {
          start
          end
        }
        availability
        reason
        plannedAvailability
        site
      }
      tooStatus {
        interval {
          start
          end
        }
        tooSupport
        site
      }
      modes {
        interval {
          start
          end
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
