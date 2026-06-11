import { MockedProvider } from '@apollo/client/testing/react';
import { GET_CONFIGURATION } from '@gql/configs/Configuration';
import type { ImportObservationInput } from '@gql/configs/gen/graphql';
import { GET_GUIDE_LOOP } from '@gql/configs/GuideLoop';
import { GET_ROTATOR } from '@gql/configs/Rotator';
import { DO_IMPORT_OBSERVATION } from '@gql/configs/Target';
import { GET_CENTRAL_WAVELENGTH, GET_GUIDE_ENVIRONMENT } from '@gql/odb/Observation';
import type { MockedResponseOf } from '@gql/util';
import { describe, expect, it, type Mock } from 'vitest';
import { renderHook, type RenderHookResult } from 'vitest-browser-react';

import { createConfiguration, createGuideLoop, createRotator } from '@/test/create';
import type { OdbObservation } from '@/types';

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
          fpu: null,
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

  it('should place basePosition first and avoid duplicates from asterism', async () => {
    const mocksWithoutGuideEnvironment = mocks.filter((mock) => mock.request.query !== GET_GUIDE_ENVIRONMENT);
    const sutWithBasePosition = await renderHook(() => useImportObservation(), {
      wrapper: ({ children }) => (
        <MockedProvider
          mocks={[...mocksWithoutGuideEnvironment, guideEnvironmentWithBasePositionMock, doImportObservationMock]}
        >
          {children}
        </MockedProvider>
      ),
    });
    await expect.poll(() => sutWithBasePosition.result.current[1].loading).toBe(false);

    const [importObservation] = sutWithBasePosition.result.current;
    await sutWithBasePosition.act(async () => {
      await importObservation(selectedObservationWithBlindOffset);
    });

    expect(doImportObservationMock.request.variables).toHaveBeenCalledOnce();
    const firstCall = doImportObservationMock.request.variables.mock.calls[0];
    expect(firstCall).toBeDefined();
    const variables = firstCall![0] as { input: ImportObservationInput };

    expect(variables.input.targets.base).toHaveLength(2);
    expect(variables.input.targets.base[0]).toMatchObject({
      id: 't-60d',
      name: 'Mayall V',
      type: 'SCIENCE',
    });
    expect(variables.input.targets.base[1]).toMatchObject({
      id: 't-60e',
      name: 'Mayall V Blind',
      type: 'BLINDOFFSET',
    });
  });

  it('should use visitor wavelength when present in observing mode', async () => {
    const mocksWithVisitor = mocks.map((mock) => {
      if (mock.request.query === GET_GUIDE_ENVIRONMENT) return guideEnvironmentWithVisitorMock;
      if (mock.request.query === GET_CENTRAL_WAVELENGTH) return centralWavelengthNoConfigMock;
      return mock;
    });
    const sutWithVisitor = await renderHook(() => useImportObservation(), {
      wrapper: ({ children }) => (
        <MockedProvider mocks={[...mocksWithVisitor, doImportObservationMock]}>{children}</MockedProvider>
      ),
    });
    await expect.poll(() => sutWithVisitor.result.current[1].loading).toBe(false);

    const [importObservation] = sutWithVisitor.result.current;
    await sutWithVisitor.act(async () => {
      await importObservation(selectedObservation);
    });

    const firstCall = doImportObservationMock.request.variables.mock.calls[0];
    expect(firstCall).toBeDefined();
    const variables = firstCall![0] as { input: ImportObservationInput };

    expect(variables.input.observation.instrument).toBeUndefined();
    expect(variables.input.targets.base[0]).toMatchObject({ wavelength: 750 });
  });

  it('should use Base position name for coordinate-only basePosition', async () => {
    const mocksWithoutGuideEnvironment = mocks.filter((mock) => mock.request.query !== GET_GUIDE_ENVIRONMENT);
    const sutWithCoordinateBasePosition = await renderHook(() => useImportObservation(), {
      wrapper: ({ children }) => (
        <MockedProvider
          mocks={[
            ...mocksWithoutGuideEnvironment,
            guideEnvironmentWithCoordinateOnlyBasePositionMock,
            doImportObservationMock,
          ]}
        >
          {children}
        </MockedProvider>
      ),
    });
    await expect.poll(() => sutWithCoordinateBasePosition.result.current[1].loading).toBe(false);

    const [importObservation] = sutWithCoordinateBasePosition.result.current;
    await sutWithCoordinateBasePosition.act(async () => {
      await importObservation(selectedObservation);
    });

    const firstCall = doImportObservationMock.request.variables.mock.calls[0];
    expect(firstCall).toBeDefined();
    const variables = firstCall![0] as { input: ImportObservationInput };

    expect(variables.input.targets.base[0]).toMatchObject({
      id: 't-101',
      name: 'Base position name',
      type: 'SCIENCE',
      sidereal: {
        coord1: 11.25,
        coord2: 40.75,
      },
    });
  });
});

const selectedObservation: OdbObservation = {
  __typename: 'Observation',
  id: 'o-2e5',
  title: 'Mayall V',
  subtitle: null,
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
    asterism: [],
    __typename: 'TargetEnvironment',
  },
};

const selectedObservationWithBlindOffset: OdbObservation = {
  ...selectedObservation,
  targetEnvironment: {
    ...selectedObservation.targetEnvironment,
    blindOffsetTarget: {
      id: 't-60e',
      name: 'Mayall V Blind',
      sidereal: {
        epoch: 'J2000.000',
        ra: {
          hms: '00:50:09.964808',
          degrees: 12.541520033333333,
          __typename: 'RightAscension',
        },
        dec: {
          dms: '+41:41:00.000000',
          degrees: 41.68333333333333,
          __typename: 'Declination',
        },
        properMotion: null,
        parallax: null,
        radialVelocity: null,
        __typename: 'Sidereal',
      },
      sourceProfile: {
        point: null,
        __typename: 'SourceProfile',
      },
      nonsidereal: null,
      __typename: 'Target',
    },
    asterism: [
      {
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
      {
        id: 't-60e',
        name: 'Mayall V Blind',
        sidereal: {
          epoch: 'J2000.000',
          ra: {
            hms: '00:50:09.964808',
            degrees: 12.541520033333333,
            __typename: 'RightAscension',
          },
          dec: {
            dms: '+41:41:00.000000',
            degrees: 41.68333333333333,
            __typename: 'Declination',
          },
          properMotion: null,
          parallax: null,
          radialVelocity: null,
          __typename: 'Sidereal',
        },
        sourceProfile: {
          point: null,
          __typename: 'SourceProfile',
        },
        nonsidereal: null,
        __typename: 'Target',
      },
    ],
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
          instrument: 'GMOS_NORTH',
          gmosNorth: {
            acquisition: {
              nextAtom: {
                id: 'a-e4720c1d-27e9-3544-b99b-2b94a483fee8',
                steps: [
                  {
                    id: 's-20ab2eeb-b3f4-3462-9044-0a1176a7e349',
                    instrumentConfig: {
                      fpu: null,
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
                      fpu: null,
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
                      fpu: null,
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
            science: null,
            __typename: 'GmosNorthExecutionConfig',
          },
          gmosSouth: null,
          flamingos2: null,
          ghost: null,
          igrins2: null,
          gnirs: null,
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
          observingMode: null,
          targetEnvironment: {
            basePosition: null,
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

const guideEnvironmentWithBasePositionMock = {
  request: {
    query: GET_GUIDE_ENVIRONMENT,
    variables: () => true,
  },
  result: (arg: { obsId: string }) => ({
    data: {
      observation: {
        __typename: 'Observation',
        id: arg.obsId,
        observingMode: null,
        targetEnvironment: {
          basePosition: {
            __typename: 'BasePosition',
            type: 'EXPLICIT_BASE',
            name: 'Mayall V',
            sidereal: {
              __typename: 'Sidereal',
              epoch: 'J2000.000',
              ra: {
                __typename: 'RightAscension',
                hms: '00:50:09.964808',
                degrees: 12.541520033333333,
              },
              dec: {
                __typename: 'Declination',
                dms: '+41:41:01.034928',
                degrees: 41.683620813333334,
              },
              properMotion: null,
              parallax: {
                __typename: 'Parallax',
                microarcseconds: 0,
              },
              radialVelocity: {
                __typename: 'RadialVelocity',
                centimetersPerSecond: -33200000,
              },
            },
            nonsidereal: null,
            coordinates: null,
          },
          guideEnvironment: {
            posAngle: {
              hms: '00:00:00.000000',
              degrees: 0,
              __typename: 'Angle',
            },
            guideTargets: [],
            __typename: 'GuideEnvironment',
          },
          __typename: 'TargetEnvironment',
        },
      },
    },
  }),
} satisfies MockedResponseOf<typeof GET_GUIDE_ENVIRONMENT>;

const guideEnvironmentWithCoordinateOnlyBasePositionMock = {
  request: {
    query: GET_GUIDE_ENVIRONMENT,
    variables: () => true,
  },
  result: (arg: { obsId: string }) => ({
    data: {
      observation: {
        __typename: 'Observation',
        id: arg.obsId,
        observingMode: null,
        targetEnvironment: {
          basePosition: {
            __typename: 'BasePosition',
            type: 'EXPLICIT_BASE',
            name: 'Base position name',
            sidereal: null,
            nonsidereal: null,
            coordinates: {
              __typename: 'Coordinates',
              ra: {
                __typename: 'RightAscension',
                hms: '00:45:00.000000',
                degrees: 11.25,
              },
              dec: {
                __typename: 'Declination',
                dms: '+40:45:00.000000',
                degrees: 40.75,
              },
            },
          },
          guideEnvironment: {
            posAngle: {
              hms: '00:00:00.000000',
              degrees: 0,
              __typename: 'Angle',
            },
            guideTargets: [],
            __typename: 'GuideEnvironment',
          },
          __typename: 'TargetEnvironment',
        },
      },
    },
  }),
} satisfies MockedResponseOf<typeof GET_GUIDE_ENVIRONMENT>;

const centralWavelengthNoConfigMock = {
  request: {
    query: GET_CENTRAL_WAVELENGTH,
    variables: () => true,
  },
  result: {
    data: {
      executionConfig: null,
    },
  },
} satisfies MockedResponseOf<typeof GET_CENTRAL_WAVELENGTH>;

const guideEnvironmentWithVisitorMock = {
  request: {
    query: GET_GUIDE_ENVIRONMENT,
    variables: () => true,
  },
  result: (arg: { obsId: string }) => ({
    data: {
      observation: {
        __typename: 'Observation',
        id: arg.obsId,
        observingMode: {
          __typename: 'ObservingMode',
          visitor: {
            __typename: 'Visitor',
            centralWavelength: {
              __typename: 'Wavelength',
              nanometers: 750,
            },
          },
        },
        targetEnvironment: {
          basePosition: null,
          guideEnvironment: {
            posAngle: {
              hms: '00:00:00.000000',
              degrees: 0,
              __typename: 'Angle',
            },
            guideTargets: [],
            __typename: 'GuideEnvironment',
          },
          __typename: 'TargetEnvironment',
        },
      },
    },
  }),
} satisfies MockedResponseOf<typeof GET_GUIDE_ENVIRONMENT>;

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
