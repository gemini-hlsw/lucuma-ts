import type {
  AltairGuideLoopItemFragment as AltairGuideLoopType,
  AltairInstrumentItemFragment as AltairInstrumentType,
  ConfigsTargetItemFragment as TargetType,
  ConfigurationItemFragment as ConfigurationType,
  GemsGuideLoopItemFragment as GemsGuideLoopType,
  GemsInstrumentItemFragment as GemsInstrumentType,
  GuideLoopItemFragment as GuideLoopType,
  GuidingType,
  InstrumentItemFragment as InstrumentType,
  MechanismItemFragment as MechanismType,
  RotatorItemFragment as RotatorType,
  Site as SiteType,
  SlewFlagsItemFragment as SlewFlagsType,
  StatusType,
  TargetInput,
  TargetType as TypeOfTarget,
} from '@gql/configs/gen/graphql';
import type {
  BrightnessItemFragment,
  ObservationItemFragment,
  SourceProfileItemFragment,
  TargetItemFragment,
} from '@gql/odb/gen/graphql';
import type { RotatorTrackingMode as TrackingType } from '@gql/server/gen/graphql';

export type ThemeType = 'light' | 'dark';

export type OdbObservationType = ObservationItemFragment;

export type OdbTargetType = TargetItemFragment;

export type OdbBandBrightnessType = BrightnessItemFragment;

export type OdbSourceProfileType = SourceProfileItemFragment;

export type {
  AltairGuideLoopType,
  AltairInstrumentType,
  ConfigurationType,
  GemsGuideLoopType,
  GemsInstrumentType,
  GuideLoopType,
  GuidingType,
  InstrumentType,
  MechanismType,
  OdbObservationType,
  RotatorType,
  SiteType,
  SlewFlagsType,
  StatusType,
  TargetInput,
  TargetType,
  TrackingType,
  TypeOfTarget,
  UserType,
};

export type PanelType = 'telescope' | 'wavefront-sensors' | 'guider';

export interface TargetEditType {
  isVisible: boolean;
  target: TargetType | null;
}
