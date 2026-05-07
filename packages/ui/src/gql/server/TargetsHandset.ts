import { useMutation } from '@apollo/client/react';
import type { QueryAndSubscriptionOptions } from '@gql/use-query-and-subscription';
import { useQueryAndSubscription } from '@gql/use-query-and-subscription';

import { graphql } from './gen';

export const TARGET_OFFSETS_FRAGMENT = graphql(`
  fragment TargetOffsetsItem on TargetOffsets {
    sourceA {
      ...FocalPlaneOffsetItem
    }
    pwfs1 {
      ...FocalPlaneOffsetItem
    }
    pwfs2 {
      ...FocalPlaneOffsetItem
    }
    oiwfs {
      ...FocalPlaneOffsetItem
    }
  }
`);

export const FOCAL_PLANE_OFFSET_FRAGMENT = graphql(`
  fragment FocalPlaneOffsetItem on FocalPlaneOffset {
    deltaX {
      arcseconds
    }
    deltaY {
      arcseconds
    }
  }
`);

export const TARGET_ADJUSTMENT_OFFSETS_QUERY = graphql(`
  query getTargetAdjustmentOffsets {
    targetAdjustmentOffsets {
      ...TargetOffsetsItem
    }
  }
`);

export const TARGET_ADJUSTMENT_OFFSETS_SUBSCRIPTION = graphql(`
  subscription targetAdjustmentOffsets {
    targetAdjustmentOffsets {
      ...TargetOffsetsItem
    }
  }
`);

export function useTargetAdjustmentOffsets(options?: QueryAndSubscriptionOptions) {
  return useQueryAndSubscription(
    TARGET_ADJUSTMENT_OFFSETS_QUERY,
    TARGET_ADJUSTMENT_OFFSETS_SUBSCRIPTION,
    'targetAdjustmentOffsets',
    options,
  );
}

export const ADJUST_TARGET_MUTATION = graphql(`
  mutation adjustTarget($target: AdjustTarget!, $offset: HandsetAdjustmentInput!, $openLoops: Boolean!) {
    adjustTarget(target: $target, offset: $offset, openLoops: $openLoops) {
      result
      msg
    }
  }
`);

export function useAdjustTarget() {
  return useMutation(ADJUST_TARGET_MUTATION);
}

export const RESET_TARGET_ADJUSTMENT_MUTATION = graphql(`
  mutation resetTargetAdjustment($target: AdjustTarget!, $openLoops: Boolean!) {
    resetTargetAdjustment(target: $target, openLoops: $openLoops) {
      result
      msg
    }
  }
`);

export function useResetTargetAdjustment() {
  return useMutation(RESET_TARGET_ADJUSTMENT_MUTATION);
}

export const ABSORB_TARGET_ADJUSTMENT_MUTATION = graphql(`
  mutation absorbTargetAdjustment($target: AdjustTarget!) {
    absorbTargetAdjustment(target: $target) {
      result
      msg
    }
  }
`);

export function useAbsorbTargetAdjustment() {
  return useMutation(ABSORB_TARGET_ADJUSTMENT_MUTATION);
}
