import { useMutation, useQuery } from '@apollo/client/react';
import { isBaseTarget, isOiTarget, isP1Target, isP2Target } from '@gql/util';
import { useMemo } from 'react';

import { graphql } from './gen';
import type { Target } from './gen/graphql';
import { GET_INSTRUMENT } from './Instrument';

export const TARGET_FRAGMENT = graphql(`
  fragment ConfigsTargetItem on Target {
    pk
    id
    name
    magnitude
    band
    type
    wavelength
    sidereal {
      ...SiderealTargetItem
    }
    nonsidereal {
      ...NonsiderealTargetItem
    }
    createdAt
  }
`);

export const SIDEREAL_TARGET_FRAGMENT = graphql(`
  fragment SiderealTargetItem on SiderealTarget {
    pk
    ra {
      degrees
      hms
    }
    dec {
      degrees
      dms
    }
    az {
      degrees
      dms
    }
    el {
      degrees
      dms
    }
    properMotion {
      ra
      dec
    }
    radialVelocity
    parallax
    epoch
  }
`);

export const NONSIDEREAL_TARGET_FRAGMENT = graphql(`
  fragment NonsiderealTargetItem on NonsiderealTarget {
    pk
    keyType
    des
  }
`);

export const GET_TARGETS = graphql(`
  query getTargets {
    targets {
      ...ConfigsTargetItem
    }
  }
`);

export function useTargets() {
  const result = useQuery(GET_TARGETS, {
    context: { clientName: 'navigateConfigs' },
  });

  return useMemo(() => {
    const targets: Target[] = result.data?.targets ?? [];

    const oiTargets = targets.filter(isOiTarget);
    const p1Targets = targets.filter(isP1Target);
    const p2Targets = targets.filter(isP2Target);
    return {
      ...result,
      data: {
        baseTargets: targets.filter(isBaseTarget),
        oiTargets: oiTargets,
        p1Targets: p1Targets,
        p2Targets: p2Targets,
        allTargets: targets,
        guiderTargets: [...oiTargets, ...p1Targets, ...p2Targets],
      },
    };
  }, [result]);
}

export const UPDATE_TARGET = graphql(`
  mutation updateTarget(
    $pk: PosInt!
    $id: TargetId
    $name: String
    $magnitude: Float
    $band: String
    $type: TargetType
    $wavelength: Int
    $sidereal: SiderealTargetUpdateInput
    $nonsidereal: NonsiderealTargetUpdateInput
  ) {
    updateTarget(
      pk: $pk
      id: $id
      name: $name
      magnitude: $magnitude
      band: $band
      type: $type
      wavelength: $wavelength
      sidereal: $sidereal
      nonsidereal: $nonsidereal
    ) {
      ...ConfigsTargetItem
    }
  }
`);

export function useUpdateTarget() {
  const targets = useTargets().data.allTargets;
  return useMutation(UPDATE_TARGET, {
    context: { clientName: 'navigateConfigs' },
    optimisticResponse: (vars, { IGNORE }) => {
      const target = targets.find((t) => t.pk === vars.pk);
      return target
        ? {
            updateTarget: {
              ...target,
              ...vars,
            } as typeof target,
          }
        : IGNORE;
    },
  });
}

export const REMOVE_AND_CREATE_BASE_TARGETS = graphql(`
  mutation removeAndCreateBaseTargets($targets: [TargetInput!]!) {
    removeAndCreateBaseTargets(targets: $targets) {
      ...ConfigsTargetItem
    }
  }
`);

export function useRemoveAndCreateBaseTargets() {
  return useMutation(REMOVE_AND_CREATE_BASE_TARGETS, {
    context: { clientName: 'navigateConfigs' },
    refetchQueries: [GET_TARGETS],
  });
}

export const DO_IMPORT_OBSERVATION = graphql(`
  mutation doImportObservation($input: ImportObservationInput!) {
    importObservation(input: $input) {
      rotator {
        ...RotatorItem
      }
      configuration {
        ...ConfigurationItem
      }
      guideLoop {
        ...GuideLoopItem
      }
    }
  }
`);

export function useDoImportObservation() {
  return useMutation(DO_IMPORT_OBSERVATION, {
    context: { clientName: 'navigateConfigs' },
    refetchQueries: [GET_TARGETS, GET_INSTRUMENT],
  });
}
