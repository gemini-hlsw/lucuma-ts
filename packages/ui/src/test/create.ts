import type {
  CalParams,
  Configuration,
  Dec,
  GuideAlarm,
  GuideLoop,
  InstrumentConfig,
  NonsiderealTarget,
  ProperMotion,
  Ra,
  Rotator,
  SiderealTarget,
} from '@gql/configs/gen/graphql';
import type { Angle as OdbAngle } from '@gql/odb/gen/graphql';

import type {
  AcMechs,
  FocalPlaneOffsetItemFragment,
  GuideConfigurationState,
  GuideQuality,
  PwfsMechsState,
  WfsConfigStateItemFragment,
} from '@/gql/server/gen/graphql';
import type { TargetType } from '@/types';

// Create helpers for GraphQL types

type Angle = Pick<OdbAngle, '__typename' | 'arcseconds'>;

type OverridePartial<T extends { __typename: string }> = Omit<Partial<T>, '__typename'>;

export function createPwfsMechState(overrides?: OverridePartial<PwfsMechsState>): PwfsMechsState {
  return {
    filter: 'NEUTRAL',
    fieldStop: 'PRISM',
    __typename: 'PwfsMechsState',
    ...overrides,
  };
}

export function createInstrumentConfig(overrides?: OverridePartial<InstrumentConfig>): InstrumentConfig {
  return {
    __typename: 'InstrumentConfig',
    pk: 1,
    name: 'GMOS_NORTH',
    iaa: 359.856,
    issPort: 3,
    focusOffset: 0,
    wfs: 'NONE',
    originX: 0,
    originY: 0,
    ao: false,
    extraParams: {},
    isTemporary: false,
    alignAngle: null,
    comment: 'Initial configuration',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

export function createConfiguration(overrides?: OverridePartial<Configuration>): Configuration {
  return {
    pk: 1,
    selectedTarget: 1,
    selectedOiTarget: 3,
    selectedP1Target: null,
    selectedP2Target: null,
    selectedGuiderTarget: null,
    oiGuidingType: 'NORMAL',
    p1GuidingType: 'NORMAL',
    p2GuidingType: 'NORMAL',
    obsTitle: 'Feige 110',
    obsId: 'o-2790',
    obsInstrument: 'GMOS_NORTH',
    obsSubtitle: null,
    obsReference: 'G-2025A-ENG-GMOSN-01-0004',
    baffleMode: 'AUTO',
    centralBaffle: null,
    deployableBaffle: null,
    __typename: 'Configuration',
    ...overrides,
  };
}

export function createGuideAlarm(overrides?: OverridePartial<GuideAlarm>): GuideAlarm {
  return {
    wfs: 'OIWFS',
    limit: 1000,
    enabled: true,
    __typename: 'GuideAlarm',
    ...overrides,
  };
}

export function createGuideState(overrides: OverridePartial<GuideConfigurationState> = {}): GuideConfigurationState {
  return {
    __typename: 'GuideConfigurationState',
    m1Input: 'OIWFS',
    m2Inputs: ['OIWFS'],
    mountOffload: true,
    m2Coma: false,
    oiIntegrating: true,
    acIntegrating: false,
    p1Integrating: false,
    p2Integrating: false,
    probeGuide: {
      from: 'GMOS_OIWFS',
      to: 'PWFS1',
      ...overrides.probeGuide,
      __typename: 'ProbeGuide',
    },
    ...overrides,
  };
}

export function createGuideQuality(overrides?: OverridePartial<GuideQuality>): GuideQuality {
  return {
    centroidDetected: false,
    flux: 999,
    __typename: 'GuideQuality',
    ...overrides,
  };
}

export function createRotator(overrides?: OverridePartial<Rotator>): Rotator {
  return { pk: 1, angle: 0, tracking: 'TRACKING', __typename: 'Rotator', ...overrides };
}

export function createGuideLoop(overrides?: OverridePartial<GuideLoop>): GuideLoop {
  return {
    pk: 1,
    m2TipTiltEnable: true,
    m2TipTiltSource: 'OIWFS',
    m2FocusEnable: true,
    m2FocusSource: 'OIWFS',
    m2TipTiltFocusLink: false,
    m2ComaEnable: false,
    m1CorrectionsEnable: true,
    m2ComaM1CorrectionsSource: 'OIWFS',
    mountOffload: true,
    daytimeMode: true,
    probeTracking: 'NONE',
    lightPath: 'Sky ➡ AO ➡ AC',
    __typename: 'GuideLoop',
    ...overrides,
  };
}

export function createAcMechs(overrides?: OverridePartial<AcMechs>): AcMechs {
  return {
    lens: 'AC',
    filter: 'B_BLUE',
    ndFilter: 'ND100',
    __typename: 'AcMechs',
    ...overrides,
  };
}

export function createAngle(overrides?: OverridePartial<Angle>): Angle {
  return {
    arcseconds: 0,
    __typename: 'Angle',
    ...overrides,
  };
}

export function createFocalPlaneOffset(
  overrides?: OverridePartial<FocalPlaneOffsetItemFragment>,
): FocalPlaneOffsetItemFragment {
  return {
    deltaX: createAngle(overrides?.deltaX),
    deltaY: createAngle(overrides?.deltaY),
    __typename: 'FocalPlaneOffset',
  };
}
export function createRA(overrides?: OverridePartial<Ra>): Ra {
  return { degrees: 12.497148925, hms: '00:49:59.315741', __typename: 'RA', ...overrides };
}

export function createDec(overrides?: OverridePartial<Dec>): Dec {
  return {
    degrees: 310.1999390236111,
    dms: '-49:48:00.219525',
    __typename: 'Dec',
    ...overrides,
  };
}

export function createProperMotion(overrides?: OverridePartial<ProperMotion>): ProperMotion {
  return {
    ra: 0,
    dec: 0,
    __typename: 'ProperMotion',
    ...overrides,
  };
}

export function createCalParams(overrides?: OverridePartial<CalParams>): CalParams {
  return {
    __typename: 'CalParams',
    pk: 1,
    site: 'GN',
    acqCamX: 518,
    acqCamY: 550,
    baffleVisible: 1.05,
    baffleNearIR: 3,
    topShutterCurrentLimit: 27,
    bottomShutterCurrentLimit: 32,
    pwfs1CenterX: 2.324,
    pwfs1CenterY: -12.213,
    pwfs1CenterZ: 0,
    pwfs2CenterX: -3.493,
    pwfs2CenterY: -2.48,
    pwfs2CenterZ: 0,
    defocusEnabled: true,
    gmosSfoDefocus: 90,
    gnirsSfoDefocus: 30,
    gnirsP1Defocus: 3.7,
    gmosP1Defocus: -7,
    gmosOiDefocus: 0,
    comment: 'Initial CalParams for GN',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

export function createTarget(overrides?: OverridePartial<TargetType>): TargetType {
  return {
    pk: 3,
    id: 't-19e',
    name: 'TYC 4517-185-1',
    sidereal: createSidereal(overrides?.sidereal ?? {}),
    nonsidereal: overrides?.nonsidereal ? createNonsidereal(overrides.nonsidereal) : null,
    type: 'SCIENCE',
    wavelength: 100,
    createdAt: '2024-09-25T11:57:29.410Z',
    band: null,
    magnitude: null,
    __typename: 'Target',
    ...overrides,
  };
}

export function createSidereal(overrides?: OverridePartial<SiderealTarget>): SiderealTarget {
  return {
    pk: 1,
    ra: createRA(),
    dec: createDec(),
    az: null,
    el: null,
    properMotion: createProperMotion(),
    radialVelocity: 0,
    parallax: 0,
    epoch: 'J2000.000',
    __typename: 'SiderealTarget',
    ...overrides,
  };
}

export function createNonsidereal(overrides?: OverridePartial<NonsiderealTarget>): NonsiderealTarget {
  return {
    pk: 1,
    keyType: 'MAJOR_BODY',
    des: '2024-001A',
    __typename: 'NonsiderealTarget',
    ...overrides,
  };
}

export function createWfsConfigState(
  overrides?: OverridePartial<WfsConfigStateItemFragment>,
): WfsConfigStateItemFragment {
  return {
    __typename: 'WfsConfigState',
    saving: false,
    ...overrides,
  };
}
