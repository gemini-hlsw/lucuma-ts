import { useMutation } from '@apollo/client/react';
import type { QueryAndSubscriptionOptions } from '@gql/use-query-and-subscription';
import { useQueryAndSubscription } from '@gql/use-query-and-subscription';

import { graphql } from './gen';

export const POINTING_CORRECTIONS_FRAGMENT = graphql(`
  fragment PointingCorrectionsItem on PointingCorrections {
    local {
      ...HorizontalOffsetItem
    }
    guide {
      ...HorizontalOffsetItem
    }
  }
`);

export const HORIZONTAL_OFFSET_FRAGMENT = graphql(`
  fragment HorizontalOffsetItem on HorizontalOffset {
    azimuth {
      arcseconds
    }
    elevation {
      arcseconds
    }
  }
`);

const POINTING_ADJUSTMENT_OFFSET_QUERY = graphql(`
  query PointingAdjustmentOffset {
    pointingAdjustmentOffset {
      ...PointingCorrectionsItem
    }
  }
`);

const POINTING_ADJUSTMENT_OFFSET_SUBSCRIPTION = graphql(`
  subscription PointingAdjustmentOffsetSub {
    pointingAdjustmentOffset {
      ...PointingCorrectionsItem
    }
  }
`);

export function usePointingAdjustmentOffset(options?: QueryAndSubscriptionOptions) {
  return useQueryAndSubscription(
    POINTING_ADJUSTMENT_OFFSET_QUERY,
    POINTING_ADJUSTMENT_OFFSET_SUBSCRIPTION,
    'pointingAdjustmentOffset',
    options,
  );
}

const ADJUST_POINTING_MUTATION = graphql(`
  mutation AdjustPointing($offset: HandsetAdjustmentInput!) {
    adjustPointing(offset: $offset) {
      result
      msg
    }
  }
`);

export function useAdjustPointing() {
  return useMutation(ADJUST_POINTING_MUTATION);
}

const RESET_LOCAL_POINTING_ADJUSTMENT_MUTATION = graphql(`
  mutation ResetLocalPointingAdjustment {
    resetLocalPointingAdjustment {
      result
      msg
    }
  }
`);

export function useResetLocalPointingAdjustment() {
  return useMutation(RESET_LOCAL_POINTING_ADJUSTMENT_MUTATION);
}

const RESET_GUIDE_POINTING_ADJUSTMENT_MUTATION = graphql(`
  mutation ResetGuidePointingAdjustment {
    resetGuidePointingAdjustment {
      result
      msg
    }
  }
`);

export function useResetGuidePointingAdjustment() {
  return useMutation(RESET_GUIDE_POINTING_ADJUSTMENT_MUTATION);
}

const ABSORB_GUIDE_POINTING_ADJUSTMENT_MUTATION = graphql(`
  mutation AbsorbGuidePointingAdjustment {
    absorbGuidePointingAdjustment {
      result
      msg
    }
  }
`);

export function useAbsorbGuidePointingAdjustment() {
  return useMutation(ABSORB_GUIDE_POINTING_ADJUSTMENT_MUTATION);
}
