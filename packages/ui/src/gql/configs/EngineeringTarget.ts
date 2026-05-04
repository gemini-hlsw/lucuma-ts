import { useQuery } from '@apollo/client/react';
import { useMemo } from 'react';

import { graphql } from './gen';

export const ENGINEERING_TARGET_FRAGMENT = graphql(`
  fragment EngineeringTargetItem on EngineeringTarget {
    pk
    id
    name
    ra {
      ...RaItem
    }
    dec {
      ...DecItem
    }
    az {
      ...AzItem
    }
    el {
      ...ElItem
    }
    properMotion {
      ...ProperMotionItem
    }
    radialVelocity
    parallax
    epoch
    type
    wavelength
    instrument
    createdAt
    rotatorAngle
    rotatorMode
    baffleMode
    centralBaffle
    deployableBaffle
  }
`);

const GET_ENGINEERING_TARGETS = graphql(`
  query getEngineeringTargets {
    engineeringTargets {
      ...EngineeringTargetItem
    }
  }
`);

export function useEngineeringTargets() {
  const result = useQuery(GET_ENGINEERING_TARGETS, {
    context: { clientName: 'navigateConfigs' },
  });

  return useMemo(() => ({ ...result, data: result.data?.engineeringTargets ?? [] }), [result]);
}
