import { MockedProvider } from '@apollo/client/testing/react';
import { GET_CONFIGURATION } from '@gql/configs/Configuration';
import { GET_GUIDE_LOOP } from '@gql/configs/GuideLoop';
import { GET_ROTATOR } from '@gql/configs/Rotator';
import { DO_IMPORT_OBSERVATION } from '@gql/configs/Target';
import { GET_CENTRAL_WAVELENGTH, GET_GUIDE_ENVIRONMENT } from '@gql/odb/Observation';
import type { MockedResponseOf } from '@gql/util';
import { describe, expect, it, type Mock } from 'vitest';
import { renderHook, type RenderHookResult } from 'vitest-browser-react';

import { createConfiguration, createGuideLoop, createRotator } from '@/test/create';
import type { OdbObservationType } from '@/types';

import { useImportObservation } from './useImportObservation';

describe(useImportObservation.name, () => {
  let sut: RenderHookResult<ReturnType<typeof useImportObservation>, unknown>;
  let callback: Mock;
  beforeEach(async () => {
    callback = vi.fn();
    sut = await renderHook(() => useImportObservation(), {
      wrapper: ({ children }) => (
        <MockedProvider mocks={[...mocks, doImportObservationMock]}>{children}</MockedProvider>
      ),
    });
    await expect.poll(() => sut.result.current[1].loading).toBe(false);
  });

  it('should call update configuration when a real observation is re-imported', async () => {
    const { result, act } = sut;
    const [importObservation] = result.current;

    await act(async () => {
      // test that import is awaited
      await importObservation(selectedObservation);
      callback();
    });

    expect(callback).toHaveBeenCalledOnce();
    expect(doImportObservationMock.request.variables).toHaveBeenCalledExactlyOnceWith({
      input: {
        configurationPk: 1,
        guideLoopPk: 1,
        guideEnvironmentAngle: {
          degrees: 0,
        },
        observation: {
          id: 'o-2e5',
          instrument: 'GMOS_NORTH',
          reference: 'G-2025B-0571-Q-0003',
          subtitle: null,
          title: 'Mayall V',
        },
        rotatorPk: 1,
        targets: {
          base: [
            {
              band: undefined,
              id: 't-60d',
              magnitude: undefined,
              name: 'Mayall V',
              sidereal: {
                coord1: 12.541520033333333,
                coord2: 41.683620813333334,
                epoch: 'J2000.000',
                parallax: 0,
                pmDec: undefined,
                pmRa: undefined,
                radialVelocity: -33200000,
              },
              type: 'SCIENCE',
              wavelength: 630,
            },
          ],
          oiwfs: [
            {
              band: 'G_RP',
              id: 't-1',
              sidereal: {
                coord1: 12.497148925,
                coord2: 41.697271505555555,
                epoch: 'J2025.763',
                parallax: undefined,
                pmDec: -6810,
                pmRa: 1121,
                radialVelocity: 0,
              },
              magnitude: 13.935516,
              name: 'Gaia DR3 375250953351514624',
              type: 'OIWFS',
            },
          ],
          pwfs1: [],
          pwfs2: [],
        },
      },
    });
  });
});

const selectedObservation: OdbObservationType = {
  __typename: 'Observation',
  id: 'o-2e5',
  title: 'Mayall V',
  subtitle: null,
  instrument: 'GMOS_NORTH',
  reference: {
    label: 'G-2025B-0571-Q-0003',
    __typename: 'ObservationReference',
  },
  program: {
    id: 'p-11d',
    pi: {
      id: 'm-14f',
      user: {
        id: 'u-7ea',
        profile: {
          givenName: 'Bryan',
          familyName: 'Miller',
          __typename: 'UserProfile',
        },
        __typename: 'User',
      },
      __typename: 'ProgramUser',
    },
    __typename: 'Program',
  },
  targetEnvironment: {
    firstScienceTarget: {
      id: 't-60d',
      name: 'Mayall V',
      sidereal: {
        epoch: 'J2000.000',
        ra: {
          hms: '00:50:09.964808',
          degrees: 12.541520033333333,
          __typename: 'RightAscension',
        },
        dec: {
          dms: '+41:41:01.034928',
          degrees: 41.683620813333334,
          __typename: 'Declination',
        },
        properMotion: null,
        parallax: {
          microarcseconds: 0,
          __typename: 'Parallax',
        },
        radialVelocity: {
          centimetersPerSecond: -33200000,
          __typename: 'RadialVelocity',
        },
        __typename: 'Sidereal',
      },
      sourceProfile: {
        point: null,
        __typename: 'SourceProfile',
      },
      nonsidereal: null,
      __typename: 'Target',
    },
    blindOffsetTarget: null,
    __typename: 'TargetEnvironment',
  },
};

const mocks = [
  {
    request: {
      query: GET_ROTATOR,
      variables: {},
    },
    result: {
      data: {
        rotator: createRotator(),
      },
    },
  } satisfies MockedResponseOf<typeof GET_ROTATOR>,
  {
    request: {
      query: GET_CONFIGURATION,
      variables: () => true,
    },
    result: {
      data: {
        configuration: createConfiguration(),
      },
    },
  } satisfies MockedResponseOf<typeof GET_CONFIGURATION>,
  {
    request: {
      query: GET_CENTRAL_WAVELENGTH,
      variables: () => true,
    },
    result: {
      data: {
        executionConfig: {
          gmosNorth: {
            acquisition: {
              nextAtom: {
                id: 'a-e4720c1d-27e9-3544-b99b-2b94a483fee8',
                steps: [
                  {
                    id: 's-20ab2eeb-b3f4-3462-9044-0a1176a7e349',
                    instrumentConfig: {
                      centralWavelength: {
                        nanometers: 630.0,
                        __typename: 'Wavelength',
                      },
                      __typename: 'GmosNorthDynamic',
                    },
                    __typename: 'GmosNorthStep',
                  },
                  {
                    id: 's-b803cf26-55db-310d-b965-e01b5acb4621',
                    instrumentConfig: {
                      centralWavelength: {
                        nanometers: 630.0,
                        __typename: 'Wavelength',
                      },
                      __typename: 'GmosNorthDynamic',
                    },
                    __typename: 'GmosNorthStep',
                  },
                  {
                    id: 's-0efe1e18-ca7a-3ae5-8395-007c99c446d6',
                    instrumentConfig: {
                      centralWavelength: {
                        nanometers: 630.0,
                        __typename: 'Wavelength',
                      },
                      __typename: 'GmosNorthDynamic',
                    },
                    __typename: 'GmosNorthStep',
                  },
                ],
                __typename: 'GmosNorthAtom',
              },
              __typename: 'GmosNorthExecutionSequence',
            },
            __typename: 'GmosNorthExecutionConfig',
          },
          gmosSouth: null,
          flamingos2: null,
          __typename: 'ExecutionConfig',
        },
      },
    },
  } satisfies MockedResponseOf<typeof GET_CENTRAL_WAVELENGTH>,
  {
    request: {
      query: GET_GUIDE_ENVIRONMENT,
      variables: () => true,
    },
    result: (arg) => ({
      data: {
        observation: {
          __typename: 'Observation',
          id: arg.obsId,
          targetEnvironment: {
            guideEnvironment: {
              posAngle: {
                hms: '00:00:00.000000',
                degrees: 0.0,
                __typename: 'Angle',
              },
              guideTargets: [
                {
                  probe: 'GMOS_OIWFS',
                  name: 'Gaia DR3 375250953351514624',
                  sidereal: {
                    epoch: 'J2025.763',
                    ra: {
                      hms: '00:49:59.315742',
                      degrees: 12.497148925,
                      __typename: 'RightAscension',
                    },
                    dec: {
                      dms: '+41:41:50.177420',
                      degrees: 41.697271505555555,
                      __typename: 'Declination',
                    },
                    properMotion: {
                      ra: {
                        microarcsecondsPerYear: 1121,
                        __typename: 'ProperMotionRA',
                      },
                      dec: {
                        microarcsecondsPerYear: -6810,
                        __typename: 'ProperMotionDeclination',
                      },
                      __typename: 'ProperMotion',
                    },
                    parallax: null,
                    radialVelocity: {
                      centimetersPerSecond: 0,
                      __typename: 'RadialVelocity',
                    },
                    __typename: 'Sidereal',
                  },
                  sourceProfile: {
                    point: {
                      bandNormalized: {
                        brightnesses: [
                          {
                            band: 'GAIA_RP',
                            value: '13.935516',
                            __typename: 'BandBrightnessIntegrated',
                          },
                        ],
                        __typename: 'BandNormalizedIntegrated',
                      },
                      __typename: 'SpectralDefinitionIntegrated',
                    },
                    __typename: 'SourceProfile',
                  },
                  nonsidereal: null,
                  __typename: 'GuideTarget',
                },
              ],
              __typename: 'GuideEnvironment',
            },
            __typename: 'TargetEnvironment',
          },
        },
      },
    }),
  } satisfies MockedResponseOf<typeof GET_GUIDE_ENVIRONMENT>,
  {
    request: {
      query: GET_GUIDE_LOOP,
      variables: () => true,
    },
    result: {
      data: {
        guideLoop: createGuideLoop(),
      },
    },
  } satisfies MockedResponseOf<typeof GET_GUIDE_LOOP>,
];

const doImportObservationMock = {
  request: {
    query: DO_IMPORT_OBSERVATION,
    variables: vi.fn().mockReturnValue(true),
  },
  result: {
    data: {
      importObservation: {
        __typename: 'ImportObservationResult',
        configuration: createConfiguration(),
        rotator: createRotator(),
        guideLoop: createGuideLoop(),
      },
    },
  },
} satisfies MockedResponseOf<typeof DO_IMPORT_OBSERVATION>;
