import { useMutation, useQuery } from '@apollo/client/react';

import { graphql } from './gen';

export const ROTATOR_FRAGMENT = graphql(`
  fragment RotatorItem on Rotator {
    pk
    angle
    tracking
  }
`);

export const GET_ROTATOR = graphql(`
  query Rotator {
    rotator {
      ...RotatorItem
    }
  }
`);

export function useRotator() {
  return useQuery(GET_ROTATOR, {
    context: { clientName: 'navigateConfigs' },
  });
}

export const UPDATE_ROTATOR = graphql(`
  mutation UpdateRotator($pk: PosInt!, $angle: Float, $tracking: RotatorTrackingMode) {
    updateRotator(pk: $pk, angle: $angle, tracking: $tracking) {
      ...RotatorItem
    }
  }
`);

export function useUpdateRotator() {
  const rotator = useRotator().data?.rotator;
  return useMutation(UPDATE_ROTATOR, {
    context: { clientName: 'navigateConfigs' },
    optimisticResponse: (vars, { IGNORE }) =>
      rotator
        ? {
            updateRotator: {
              ...rotator,
              ...vars,
            } as typeof rotator,
          }
        : IGNORE,
  });
}
