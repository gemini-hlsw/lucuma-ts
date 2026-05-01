import { useQuery } from '@apollo/client/react';

import { graphql } from './gen';
import type { Site } from './gen/graphql';

export const GET_TELESCOPE_NIGHT_TIMELINE = graphql(`
  query getTelescopeNightTimeline($site: Site!, $observingDate: Date!) {
    telescopeNightTimeline(site: $site, observingDate: $observingDate) {
      site
      observingDate
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

export function useTelescopeNightTimeline(site: Site, observingDate: string) {
  return useQuery(GET_TELESCOPE_NIGHT_TIMELINE, {
    variables: {
      site,
      observingDate,
    },
  });
}
