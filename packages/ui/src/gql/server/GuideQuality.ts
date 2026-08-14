import { useQueryAndSubscription } from '@gql/use-query-and-subscription';

import { graphql } from './gen';

export const GUIDERS_QUALITY_VALUES_FRAGMENT = graphql(`
  fragment GuidersQualityValuesItem on GuidersQualityValues {
    pwfs1 {
      ...GuideQualityItem
    }
    pwfs2 {
      ...GuideQualityItem
    }
    oiwfs {
      ...GuideQualityItem
    }
  }
`);

export const GUIDE_QUALITY_FRAGMENT = graphql(`
  fragment GuideQualityItem on GuideQuality {
    flux
    centroidDetected
  }
`);

export const GUIDE_QUALITY_QUERY = graphql(`
  query GuidersQualityValues {
    guidersQualityValues {
      ...GuidersQualityValuesItem
    }
  }
`);

export const GUIDE_QUALITY_SUBSCRIPTION = graphql(`
  subscription GuidersQualityValuesSub {
    guidersQualityValues {
      ...GuidersQualityValuesItem
    }
  }
`);

export function useGuideQualities() {
  return useQueryAndSubscription(GUIDE_QUALITY_QUERY, GUIDE_QUALITY_SUBSCRIPTION, 'guidersQualityValues', {
    useStale: false,
  });
}
