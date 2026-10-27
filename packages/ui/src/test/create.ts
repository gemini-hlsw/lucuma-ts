import type {
  AcMechs,
  CalParams,
  Configuration,
  Declination,
  EnclosureState,
  FocalPlaneOffset,
  GuideAlarm,
  GuideLoop,
  GuideQuality,
  GuideState,
  InstrumentConfig,
  Mechanism,
  MechSystemState,
  NonsiderealTarget,
  OdbObservation,
  OdbSidereal,
  OdbTarget,
  ProperMotion,
  ProperMotionDeclination,
  ProperMotionRA,
  PwfsMechs,
  RightAscension,
  Rotator,
  ServerConfiguration,
  SiderealTarget,
  Target,
  TelescopeState,
  WfsConfigState,
} from '@/types';

// Create helpers for GraphQL types
type FocalPlaneAngle = FocalPlaneOffset['deltaX'];
type OdbObservationReference = NonNullable<OdbObservation['reference']>;
type OdbProgram = OdbObservation['program'];
type OdbTargetEnvironment = OdbObservation['targetEnvironment'];

export type OverridePartial<T extends { __typename: string }> = Omit<Partial<T>, '__typename'>;

/**
 * Makes a helper function to create instances of a GraphQL type with default values and optional overrides.
 */
function makeCreateHelper<T extends { __typename: string }>(defaults: () => T) {
  return (overrides?: OverridePartial<T>): T => ({ ...defaults(), ...overrides });
}

export const createPwfsMechState = makeCreateHelper<PwfsMechs>(() => ({
  filter: 'NEUTRAL',
  fieldStop: 'PRISM',
  __typename: 'PwfsMechsState',
}));

export const createInstrumentConfig = makeCreateHelper<InstrumentConfig>(() => ({
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
}));

export const createConfiguration = makeCreateHelper<Configuration>(() => ({
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
  programLabel: 'G-2025A-ENG-GMOSN-01',
  baffleMode: 'AUTO',
  centralBaffle: null,
  deployableBaffle: null,
  fpu: null,
  __typename: 'Configuration',
}));

export const createObservation = makeCreateHelper<OdbObservation>(() => ({
  id: 'o-1',
  title: 'Observation',
  subtitle: null,
  instrument: 'GMOS_NORTH',
  reference: createOdbObservationReference(),
  program: createOdbProgram(),
  targetEnvironment: createOdbTargetEnvironment(),
  __typename: 'Observation',
}));

export const createOdbObservationReference = makeCreateHelper<OdbObservationReference>(() => ({
  label: 'G-2025B-0001-Q-0001',
  __typename: 'ObservationReference',
}));

export const createOdbProgram = makeCreateHelper<OdbProgram>(() => ({
  id: 'p-1',
  pi: {
    id: 'm-1',
    user: {
      id: 'u-1',
      profile: { givenName: 'Ada', familyName: 'Lovelace', __typename: 'UserProfile' },
      __typename: 'User',
    },
    __typename: 'ProgramUser',
  },
  reference: { label: 'G-2025B-0001', __typename: 'ScienceProgramReference' },
  __typename: 'Program',
}));

export const createOdbTargetEnvironment = makeCreateHelper<OdbTargetEnvironment>(() => ({
  firstScienceTarget: null,
  blindOffsetTarget: null,
  asterism: [],
  useBlindOffset: false,
  __typename: 'TargetEnvironment',
}));

export const createOdbTarget = makeCreateHelper<OdbTarget>(() => ({
  id: 't-1',
  name: 'Target',
  sidereal: createOdbSidereal(),
  sourceProfile: { point: null, __typename: 'SourceProfile' },
  nonsidereal: null,
  __typename: 'Target',
}));

export const createOdbSidereal = makeCreateHelper<OdbSidereal>(() => ({
  epoch: 'J2000.000',
  ra: createRightAscension(),
  dec: createDeclination(),
  properMotion: null,
  parallax: null,
  radialVelocity: null,
  __typename: 'Sidereal',
}));

export const createGuideAlarm = makeCreateHelper<GuideAlarm>(() => ({
  wfs: 'OIWFS',
  limit: 1000,
  enabled: true,
  __typename: 'GuideAlarm',
}));

export const createGuideState = makeCreateHelper<GuideState>(() => ({
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
    __typename: 'ProbeGuide',
  },
}));

export const createGuideQuality = makeCreateHelper<GuideQuality>(() => ({
  centroidDetected: false,
  flux: 999,
  __typename: 'GuideQuality',
}));

export const createRotator = makeCreateHelper<Rotator>(() => ({
  pk: 1,
  angle: 0,
  tracking: 'TRACKING',
  __typename: 'Rotator',
}));

export const createGuideLoop = makeCreateHelper<GuideLoop>(() => ({
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
}));

export const createAcMechs = makeCreateHelper<AcMechs>(() => ({
  lens: 'AC',
  filter: 'B_BLUE',
  ndFilter: 'ND100',
  __typename: 'AcMechs',
}));

export const createAngle = makeCreateHelper<FocalPlaneAngle>(() => ({
  arcseconds: 0,
  __typename: 'Angle',
}));

export const createFocalPlaneOffset = makeCreateHelper<FocalPlaneOffset>(() => ({
  deltaX: createAngle(),
  deltaY: createAngle(),
  __typename: 'FocalPlaneOffset',
}));

export const createRightAscension = makeCreateHelper<RightAscension>(() => ({
  degrees: 12.497148925,
  hms: '00:49:59.315741',
  __typename: 'RightAscension',
}));

export const createDeclination = makeCreateHelper<Declination>(() => ({
  degrees: 310.1999390236111,
  dms: '-49:48:00.219525',
  __typename: 'Declination',
}));

export const createProperMotion = makeCreateHelper<ProperMotion>(() => ({
  __typename: 'ProperMotion',
  ra: createProperMotionRA(),
  dec: createProperMotionDeclination(),
}));
export const createProperMotionRA = makeCreateHelper<ProperMotionRA>(() => ({
  __typename: 'ProperMotionRA',
  microarcsecondsPerYear: 0,
}));

export const createProperMotionDeclination = makeCreateHelper<ProperMotionDeclination>(() => ({
  __typename: 'ProperMotionDeclination',
  microarcsecondsPerYear: 0,
}));

export const createCalParams = makeCreateHelper<CalParams>(() => ({
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
}));

export const createTarget = makeCreateHelper<Target>(() => ({
  pk: 3,
  id: 't-19e',
  name: 'TYC 4517-185-1',
  sidereal: createSidereal(),
  nonsidereal: null,
  type: 'SCIENCE',
  wavelength: 100,
  createdAt: '2024-09-25T11:57:29.410Z',
  band: null,
  magnitude: null,
  __typename: 'Target',
}));

export const createSidereal = makeCreateHelper<SiderealTarget>(() => ({
  pk: 1,
  ra: createRightAscension(),
  dec: createDeclination(),
  az: null,
  el: null,
  properMotion: createProperMotion(),
  radialVelocity: 0,
  parallax: 0,
  epoch: 'J2000.000',
  __typename: 'SiderealTarget',
}));

export const createNonsidereal = makeCreateHelper<NonsiderealTarget>(() => ({
  pk: 1,
  keyType: 'MAJOR_BODY',
  des: '2024-001A',
  __typename: 'NonsiderealTarget',
}));

export const createWfsConfigState = makeCreateHelper<WfsConfigState>(() => ({
  __typename: 'WfsConfigState',
  saving: false,
}));

export const createMechSystemState = makeCreateHelper<MechSystemState>(() => ({
  __typename: 'MechSystemState',
  parked: 'NOT_PARKED',
  follow: 'FOLLOWING',
}));

export const createEnclosureState = makeCreateHelper<EnclosureState>(() => ({
  __typename: 'EnclosureState',
  domeEnabled: true,
  domeMode: 'MIN_VIBRATION',
  shuttersEnabled: true,
  shuttersMode: {
    __typename: 'ShutterMode',
    mode: 'TRACKING',
    aperture: { __typename: 'Distance', meters: 15.5 },
  },
  eastVentGateAperture: 50,
  westVentGateAperture: 50,
}));

export const createTelescopeState = makeCreateHelper<TelescopeState>(() => ({
  __typename: 'TelescopeState',
  mount: createMechSystemState(),
  scs: createMechSystemState(),
  crcs: createMechSystemState(),
  pwfs1: createMechSystemState(),
  pwfs2: createMechSystemState(),
  oiwfs: createMechSystemState(),
  enclosure: createEnclosureState(),
}));

export const createMechanism = makeCreateHelper<Mechanism>(() => ({
  __typename: 'Mechanism',
  pk: 1,
  mcs: 'ACTIVE',
  mcsPark: 'ACTIVE',
  mcsUnwrap: 'ACTIVE',
  scs: 'ACTIVE',
  crcs: 'ACTIVE',
  crcsPark: 'ACTIVE',
  crcsUnwrap: 'ACTIVE',
  pwfs1: 'ACTIVE',
  pwfs1Park: 'ACTIVE',
  pwfs1Unwrap: 'ACTIVE',
  pwfs2: 'ACTIVE',
  pwfs2Park: 'ACTIVE',
  pwfs2Unwrap: 'ACTIVE',
  oiwfs: 'ACTIVE',
  oiwfsPark: 'ACTIVE',
  odgw: 'ACTIVE',
  odgwPark: 'ACTIVE',
  aowfs: 'ACTIVE',
  aowfsPark: 'ACTIVE',
  dome: 'ACTIVE',
  domePark: 'ACTIVE',
  domeMode: 'MinVibration',
  shutters: 'ACTIVE',
  shuttersPark: 'ACTIVE',
  shutterMode: 'Tracking',
  shutterAperture: 90,
  wVGate: 'ACTIVE',
  wVGateClose: 'ACTIVE',
  wVGateValue: 50,
  eVGate: 'ACTIVE',
  eVGateClose: 'ACTIVE',
  eVGateValue: 50,
  agScienceFoldPark: 'ACTIVE',
  agAoFoldPark: 'ACTIVE',
  agAcPickoffPark: 'ACTIVE',
  agParkAll: 'ACTIVE',
}));

export const createServerConfiguration = makeCreateHelper<ServerConfiguration>(() => ({
  __typename: 'ServerConfiguration',
  site: 'GN',
  odbUri: 'https://lucuma-postgres-odb-dev.herokuapp.com/odb',
  ssoUri: 'https://sso-dev.gpp.gemini.edu',
}));
