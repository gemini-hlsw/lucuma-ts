import type { Site } from '@gql/gen/graphql';
import type {
  InstrumentAvailabilityBlockItem,
  InstrumentLocationItem,
  TelescopeAvailabilityBlockItem,
  TelescopeModeBlockItem,
  TelescopeSubsystemAvailabilityBlockItem,
  TooSupportBlockItem,
} from '@gql/types';

import { observingNightInterval } from '@/domain/siteTime';

type Interval = InstrumentAvailabilityBlockItem['interval'];

/** The half-open interval from the start of `firstNight` to the end of `lastNight`, both observing nights. */
export const overNights = (site: Site, firstNight: string, lastNight: string): Interval => ({
  __typename: 'TimestampInterval',
  start: new Date(observingNightInterval(site, firstNight).start).toISOString(),
  end: new Date(observingNightInterval(site, lastNight).end).toISOString(),
});

type Placement = { readonly port: number } | { readonly place: Exclude<InstrumentLocationItem['place'], 'PORT'> };

export const instrumentAvailabilityBlock = ({
  instrument,
  interval,
  publishedName = instrument,
  usage = 'SCIENCE',
  note = null,
  ...placement
}: Pick<InstrumentAvailabilityBlockItem, 'instrument' | 'interval'> &
  Partial<Pick<InstrumentAvailabilityBlockItem, 'publishedName' | 'usage' | 'note'>> &
  Placement): InstrumentAvailabilityBlockItem => ({
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
}: Pick<TelescopeAvailabilityBlockItem, 'interval'> &
  Partial<Omit<TelescopeAvailabilityBlockItem, '__typename' | 'interval'>>): TelescopeAvailabilityBlockItem => ({
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
}: Pick<TooSupportBlockItem, 'interval'> &
  Partial<Omit<TooSupportBlockItem, '__typename' | 'interval'>>): TooSupportBlockItem => ({
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
}: Pick<TelescopeModeBlockItem, 'interval'> &
  Partial<Omit<TelescopeModeBlockItem, '__typename' | 'interval'>>): TelescopeModeBlockItem => ({
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
}: Pick<TelescopeSubsystemAvailabilityBlockItem, 'subsystem' | 'interval'> &
  Partial<
    Omit<TelescopeSubsystemAvailabilityBlockItem, '__typename' | 'subsystem' | 'interval'>
  >): TelescopeSubsystemAvailabilityBlockItem => ({
  __typename: 'TelescopeSubsystemAvailabilityBlock',
  subsystem,
  usage,
  powerSource,
  note,
  interval,
});
