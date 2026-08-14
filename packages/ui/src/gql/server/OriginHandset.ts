import { useMutation } from '@apollo/client/react';
import type { QueryAndSubscriptionOptions } from '@gql/use-query-and-subscription';
import { useQueryAndSubscription } from '@gql/use-query-and-subscription';

import { graphql } from './gen';

const ORIGIN_ADJUSTMENT_OFFSET_QUERY = graphql(`
  query OriginAdjustmentOffset {
    originAdjustmentOffset {
      ...FocalPlaneOffsetItem
    }
  }
`);

const ORIGIN_ADJUSTMENT_OFFSET_SUBSCRIPTION = graphql(`
  subscription OriginAdjustmentOffsetSub {
    originAdjustmentOffset {
      ...FocalPlaneOffsetItem
    }
  }
`);

export function useOriginAdjustmentOffset(options?: QueryAndSubscriptionOptions) {
  return useQueryAndSubscription(
    ORIGIN_ADJUSTMENT_OFFSET_QUERY,
    ORIGIN_ADJUSTMENT_OFFSET_SUBSCRIPTION,
    'originAdjustmentOffset',
    options,
  );
}

const ADJUST_ORIGIN_MUTATION = graphql(`
  mutation AdjustOrigin($offset: HandsetAdjustmentInput!, $openLoops: Boolean!) {
    adjustOrigin(offset: $offset, openLoops: $openLoops) {
      result
      msg
    }
  }
`);

export function useAdjustOrigin() {
  return useMutation(ADJUST_ORIGIN_MUTATION);
}

const RESET_ORIGIN_ADJUSTMENT_MUTATION = graphql(`
  mutation ResetOriginAdjustment($openLoops: Boolean!) {
    resetOriginAdjustment(openLoops: $openLoops) {
      result
      msg
    }
  }
`);

export function useResetOriginAdjustment() {
  return useMutation(RESET_ORIGIN_ADJUSTMENT_MUTATION);
}

const ABSORB_ORIGIN_ADJUSTMENT_MUTATION = graphql(`
  mutation AbsorbOriginAdjustment {
    absorbOriginAdjustment {
      result
      msg
    }
  }
`);

export function useAbsorbOriginAdjustment() {
  return useMutation(ABSORB_ORIGIN_ADJUSTMENT_MUTATION);
}
