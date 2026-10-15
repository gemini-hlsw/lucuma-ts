import type {
  InstrumentAvailabilityBlockItemFragment,
  Site,
  TelescopeAvailabilityBlockItemFragment,
  TelescopeModeBlockItemFragment,
  TelescopeSubsystemAvailabilityBlockItemFragment,
  TooSupportBlockItemFragment,
} from '@gql/gen/graphql';

import { observingNightInterval } from '@/domain/siteTime';

type Interval = InstrumentAvailabilityBlockItemFragment['interval'];

/** The half-open interval from the start of `firstNight` to the end of `lastNight`, both observing nights. */
export const overNights = (site: Site, firstNight: string, lastNight: string): Interval => ({
  __typename: 'TimestampInterval',
  start: new Date(observingNightInterval(site, firstNight).start).toISOString(),
  end: new Date(observingNightInterval(site, lastNight).end).toISOString(),
});

type Placement =
  | { readonly port: number }
  | { readonly place: Exclude<InstrumentAvailabilityBlockItemFragment['location']['place'], 'PORT'> };

export const instrumentAvailabilityBlock = ({
  instrument,
  interval,
  publishedName = instrument,
  usage = 'SCIENCE',
  note = null,
  ...placement
}: Pick<InstrumentAvailabilityBlockItemFragment, 'instrument' | 'interval'> &
  Partial<Pick<InstrumentAvailabilityBlockItemFragment, 'publishedName' | 'usage' | 'note'>> &
  Placement): InstrumentAvailabilityBlockItemFragment => ({
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
}: Pick<TelescopeAvailabilityBlockItemFragment, 'interval'> &
  Partial<
    Omit<TelescopeAvailabilityBlockItemFragment, '__typename' | 'interval'>
  >): TelescopeAvailabilityBlockItemFragment => ({
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
}: Pick<TooSupportBlockItemFragment, 'interval'> &
  Partial<Omit<TooSupportBlockItemFragment, '__typename' | 'interval'>>): TooSupportBlockItemFragment => ({
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
}: Pick<TelescopeModeBlockItemFragment, 'interval'> &
  Partial<Omit<TelescopeModeBlockItemFragment, '__typename' | 'interval'>>): TelescopeModeBlockItemFragment => ({
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
}: Pick<TelescopeSubsystemAvailabilityBlockItemFragment, 'subsystem' | 'interval'> &
  Partial<
    Omit<TelescopeSubsystemAvailabilityBlockItemFragment, '__typename' | 'subsystem' | 'interval'>
  >): TelescopeSubsystemAvailabilityBlockItemFragment => ({
  __typename: 'TelescopeSubsystemAvailabilityBlock',
  subsystem,
  usage,
  powerSource,
  note,
  interval,
});
