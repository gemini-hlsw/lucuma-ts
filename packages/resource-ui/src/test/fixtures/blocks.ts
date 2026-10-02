import type {
  ClosureFieldsFragment,
  InstrumentBlockFieldsFragment,
  ModeBlockFieldsFragment,
  Site,
  SubsystemBlockFieldsFragment,
  TooBlockFieldsFragment,
} from '@gql/gen/graphql';

import { observingNightInterval } from '@/domain/siteTime';

type Interval = InstrumentBlockFieldsFragment['interval'];

/** The half-open interval from the start of `firstNight` to the end of `lastNight`, both observing nights. */
export const overNights = (site: Site, firstNight: string, lastNight: string): Interval => ({
  __typename: 'TimestampInterval',
  start: new Date(observingNightInterval(site, firstNight).start).toISOString(),
  end: new Date(observingNightInterval(site, lastNight).end).toISOString(),
});

type Placement =
  { readonly port: number } | { readonly place: Exclude<InstrumentBlockFieldsFragment['location']['place'], 'PORT'> };

export const instrumentAvailabilityBlock = ({
  instrument,
  interval,
  publishedName = instrument,
  usage = 'SCIENCE',
  note = null,
  ...placement
}: Pick<InstrumentBlockFieldsFragment, 'instrument' | 'interval'> &
  Partial<Pick<InstrumentBlockFieldsFragment, 'publishedName' | 'usage' | 'note'>> &
  Placement): InstrumentBlockFieldsFragment => ({
  __typename: 'InstrumentAvailabilityBlock',
  instrument,
  publishedName,
  usage,
  note,
  interval,
  location:
    'port' in placement
      ? { __typename: 'InstrumentLocation', place: 'PORT', port: placement.port }
      : { __typename: 'InstrumentLocation', place: placement.place, port: null },
});

/** `port: null` is the whole telescope. */
export const telescopeAvailabilityBlock = ({
  interval,
  availability = 'CLOSED',
  port = null,
  reason = null,
}: Pick<ClosureFieldsFragment, 'interval'> &
  Partial<Omit<ClosureFieldsFragment, '__typename' | 'interval'>>): ClosureFieldsFragment => ({
  __typename: 'TelescopeAvailabilityBlock',
  availability,
  port,
  reason,
  interval,
});

export const tooSupportBlock = ({
  interval,
  tooSupport = 'STANDARD',
  note = null,
}: Pick<TooBlockFieldsFragment, 'interval'> &
  Partial<Omit<TooBlockFieldsFragment, '__typename' | 'interval'>>): TooBlockFieldsFragment => ({
  __typename: 'TooSupportBlock',
  tooSupport,
  note,
  interval,
});

export const telescopeModeBlock = ({
  interval,
  mode = 'QUEUE',
  programReferences = [],
  partner = null,
  note = null,
}: Pick<ModeBlockFieldsFragment, 'interval'> &
  Partial<Omit<ModeBlockFieldsFragment, '__typename' | 'interval'>>): ModeBlockFieldsFragment => ({
  __typename: 'TelescopeModeBlock',
  mode,
  programReferences,
  partner,
  note,
  interval,
});

export const telescopeSubsystemAvailabilityBlock = ({
  subsystem,
  interval,
  usage = 'SCIENCE',
  powerSource = null,
  note = null,
}: Pick<SubsystemBlockFieldsFragment, 'subsystem' | 'interval'> &
  Partial<
    Omit<SubsystemBlockFieldsFragment, '__typename' | 'subsystem' | 'interval'>
  >): SubsystemBlockFieldsFragment => ({
  __typename: 'TelescopeSubsystemAvailabilityBlock',
  subsystem,
  usage,
  powerSource,
  note,
  interval,
});
