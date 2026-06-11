import { skipToken, useLazyQuery, useQuery } from '@apollo/client/react';
import type { OptionsOf } from '@gql/util';

import { graphql } from './gen';

export const OBSERVATION_FRAGMENT = graphql(`
  fragment ObservationItem on Observation {
    id
    title
    subtitle
    reference {
      label
    }
    program {
      id
      pi {
        id
        user {
          id
          profile {
            givenName
            familyName
          }
        }
      }
    }
    targetEnvironment {
      firstScienceTarget {
        ...TargetItem
      }
      blindOffsetTarget {
        ...TargetItem
      }
      asterism {
        ...TargetItem
      }
    }
  }
`);

export const TARGET_FRAGMENT = graphql(`
  fragment TargetItem on Target {
    id
    name
    sidereal {
      ...SiderealItem
    }
    sourceProfile {
      ...SourceProfileItem
    }
    nonsidereal {
      ...NonsiderealItem
    }
  }
`);

export const SIDEREAL_FRAGMENT = graphql(`
  fragment SiderealItem on Sidereal {
    epoch
    ra {
      hms
      degrees
    }
    dec {
      dms
      degrees
    }
    properMotion {
      ra {
        microarcsecondsPerYear
      }
      dec {
        microarcsecondsPerYear
      }
    }
    parallax {
      microarcseconds
    }
    radialVelocity {
      centimetersPerSecond
    }
  }
`);

export const NONSIDEREAL_FRAGMENT = graphql(`
  fragment NonsiderealItem on Nonsidereal {
    des
    keyType
  }
`);

export const BRIGHTNESS_INTEGRATED_FRAGMENT = graphql(`
  fragment BrightnessIntegratedItem on BandBrightnessIntegrated {
    band
    value
  }
`);

export const SOURCE_PROFILE_FRAGMENT = graphql(`
  fragment SourceProfileItem on SourceProfile {
    point {
      bandNormalized {
        brightnesses {
          ...BrightnessIntegratedItem
        }
      }
    }
  }
`);

export const BASE_POSITION_FRAGMENT = graphql(`
  fragment BasePositionItem on BasePosition {
    type
    name
    sidereal {
      ...SiderealItem
    }
    nonsidereal {
      ...NonsiderealItem
    }
    coordinates {
      ra {
        hms
        degrees
      }
      dec {
        dms
        degrees
      }
    }
  }
`);

export const VISITOR_FRAGMENT = graphql(`
  fragment VisitorItem on Visitor {
    centralWavelength {
      ...WavelengthItem
    }
  }
`);

const GET_OBSERVATION_BY_ID = graphql(`
  query getObservationById($obsId: ObservationId!) {
    observation(observationId: $obsId) {
      ...ObservationItem
    }
  }
`);

export function useObservationById() {
  return useLazyQuery(GET_OBSERVATION_BY_ID, { fetchPolicy: 'network-only' });
}

const GET_OBSERVATIONS_BY_STATE = graphql(`
  # eslint-disable @graphql-eslint/selection-set-depth
  query getObservationsByState($states: [ObservationWorkflowState!]!, $site: Site!, $date: Date!) {
    observations(
      WHERE: {
        workflow: { workflowState: { IN: $states } }
        site: { EQ: $site }
        program: { AND: [{ activeStart: { LTE: $date } }, { activeEnd: { GTE: $date } }] }
        reference: { IS_NULL: false }
      }
    ) {
      matches {
        ...ObservationItem
      }
    }
  }
`);

export function useObservationsByState(options: OptionsOf<typeof GET_OBSERVATIONS_BY_STATE>) {
  return useQuery(
    GET_OBSERVATIONS_BY_STATE,
    options === skipToken
      ? skipToken
      : {
          ...options,
          context: { clientName: 'odb' },
          fetchPolicy: 'cache-and-network',
        },
  );
}

export const GET_GUIDE_ENVIRONMENT = graphql(`
  # eslint-disable @graphql-eslint/selection-set-depth
  query getGuideEnvironment($obsId: ObservationId!) {
    observation(observationId: $obsId) {
      id
      observingMode {
        visitor {
          ...VisitorItem
        }
      }
      targetEnvironment {
        cassRotator
        basePosition {
          ...BasePositionItem
        }
        guideEnvironment {
          posAngle {
            degrees
          }
          guideTargets {
            probe
            name
            sidereal {
              ...SiderealItem
            }
            sourceProfile {
              ...SourceProfileItem
            }
            nonsidereal {
              ...NonsiderealItem
            }
          }
        }
      }
    }
  }
`);

export function useGetGuideEnvironment() {
  return useLazyQuery(GET_GUIDE_ENVIRONMENT, { errorPolicy: 'all', fetchPolicy: 'network-only' });
}

export const CENTRAL_WAVELENGTH_FRAGMENT = graphql(`
  fragment WavelengthItem on Wavelength {
    nanometers
  }
`);

export const GMOS_NORTH_EXECUTION_SEQUENCE_FRAGMENT = graphql(`
  fragment GmosNorthExecutionSequenceItem on GmosNorthExecutionSequence {
    nextAtom {
      id
      steps {
        id
        instrumentConfig {
          fpu {
            builtin
          }
          centralWavelength {
            ...WavelengthItem
          }
        }
      }
    }
  }
`);

export const GMOS_SOUTH_EXECUTION_SEQUENCE_FRAGMENT = graphql(`
  fragment GmosSouthExecutionSequenceItem on GmosSouthExecutionSequence {
    nextAtom {
      id
      steps {
        id
        instrumentConfig {
          fpu {
            builtin
          }
          centralWavelength {
            ...WavelengthItem
          }
        }
      }
    }
  }
`);

export const FLAMINGOS2_EXECUTION_SEQUENCE_FRAGMENT = graphql(`
  fragment Flamingos2ExecutionSequenceItem on Flamingos2ExecutionSequence {
    nextAtom {
      id
      steps {
        id
        instrumentConfig {
          fpu {
            builtin
          }
          centralWavelength {
            ...WavelengthItem
          }
        }
      }
    }
  }
`);

export const GHOST_EXECUTION_SEQUENCE_FRAGMENT = graphql(`
  fragment GhostExecutionSequenceItem on GhostExecutionSequence {
    nextAtom {
      id
      steps {
        id
        instrumentConfig {
          centralWavelength {
            ...WavelengthItem
          }
        }
      }
    }
  }
`);

export const IGRINS2_EXECUTION_SEQUENCE_FRAGMENT = graphql(`
  fragment Igrins2ExecutionSequenceItem on Igrins2ExecutionSequence {
    nextAtom {
      id
      steps {
        id
        instrumentConfig {
          centralWavelength {
            ...WavelengthItem
          }
        }
      }
    }
  }
`);

export const GNIRS_EXECUTION_SEQUENCE_FRAGMENT = graphql(`
  fragment GnirsExecutionSequenceItem on GnirsExecutionSequence {
    nextAtom {
      id
      steps {
        id
        instrumentConfig {
          centralWavelength {
            ...WavelengthItem
          }
        }
      }
    }
  }
`);

export const GET_CENTRAL_WAVELENGTH = graphql(`
  query getCentralWavelength($obsId: ObservationId!) {
    executionConfig(observationId: $obsId) {
      instrument
      gmosNorth {
        acquisition {
          ...GmosNorthExecutionSequenceItem
        }
        science {
          ...GmosNorthExecutionSequenceItem
        }
      }
      gmosSouth {
        acquisition {
          ...GmosSouthExecutionSequenceItem
        }
        science {
          ...GmosSouthExecutionSequenceItem
        }
      }
      flamingos2 {
        acquisition {
          ...Flamingos2ExecutionSequenceItem
        }
        science {
          ...Flamingos2ExecutionSequenceItem
        }
      }
      ghost {
        science {
          ...GhostExecutionSequenceItem
        }
      }
      igrins2 {
        science {
          ...Igrins2ExecutionSequenceItem
        }
      }
      gnirs {
        acquisition {
          ...GnirsExecutionSequenceItem
        }
        science {
          ...GnirsExecutionSequenceItem
        }
      }
    }
  }
`);

export function useGetCentralWavelength() {
  return useLazyQuery(GET_CENTRAL_WAVELENGTH, { errorPolicy: 'all', fetchPolicy: 'network-only' });
}
