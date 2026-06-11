import type { Flamingos2Fpu, GmosNorthBuiltinFpu, GmosSouthBuiltinFpu } from '@gql/odb/gen/graphql';

export type {
  AltairGuideLoopItemFragment as AltairGuideLoop,
  AltairInstrumentItemFragment as AltairInstrument,
  AngleItemFragment as Angle,
  CalParamsItemFragment as CalParams,
  ConfigurationItemFragment as Configuration,
  DeclinationItemFragment as Declination,
  EngineeringTargetItemFragment as EngineeringTarget,
  GemsGuideLoopItemFragment as GemsGuideLoop,
  GemsInstrumentItemFragment as GemsInstrument,
  GuideAlarmItemFragment as GuideAlarm,
  GuideLoopItemFragment as GuideLoop,
  InstrumentConfigItemFragment as InstrumentConfig,
  MechanismItemFragment as Mechanism,
  NonsiderealTargetItemFragment as NonsiderealTarget,
  ProperMotionItemFragment as ProperMotion,
  ProperMotionDeclinationItemFragment as ProperMotionDeclination,
  ProperMotionRaItemFragment as ProperMotionRA,
  RightAscensionItemFragment as RightAscension,
  RotatorItemFragment as Rotator,
  SiderealTargetItemFragment as SiderealTarget,
  SlewFlagsItemFragment as SlewFlags,
  ConfigsTargetItemFragment as Target,
} from '@gql/configs/gen/graphql';
export type {
  BasePositionItemFragment as BasePosition,
  GmosNorthBuiltinFpu,
  GmosSouthBuiltinFpu,
  BrightnessIntegratedItemFragment as OdbBandBrightness,
  ObservationItemFragment as OdbObservation,
  SourceProfileItemFragment as OdbSourceProfile,
  TargetItemFragment as OdbTarget,
  VisitorItemFragment as Visitor,
} from '@gql/odb/gen/graphql';
export type {
  AcMechsItemFragment as AcMechs,
  FocalPlaneOffsetItemFragment as FocalPlaneOffset,
  GuideQualityItemFragment as GuideQuality,
  GuideConfigurationStateItemFragment as GuideState,
  LogMessageItemFragment as LogMessage,
  MechSystemStateItemFragment as MechSystemState,
  PwfsMechsStateItemFragment as PwfsMechs,
  ServerConfigurationItemFragment as ServerConfiguration,
  TelescopeStateItemFragment as TelescopeState,
  WfsConfigStateItemFragment as WfsConfigState,
} from '@gql/server/gen/graphql';

export type Fpu = Flamingos2Fpu | GmosNorthBuiltinFpu | GmosSouthBuiltinFpu;
