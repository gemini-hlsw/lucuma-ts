import type {
  InstrumentAvailabilityBlockItem,
  TelescopeAvailabilityBlockItem,
  TelescopeModeBlockItem,
  TelescopeNightItem,
  TimestampIntervalItem,
  TooSupportBlockItem,
} from '@gql/types';

import { observingNightInterval } from '@/domain/siteTime';
import type { OffPortPlace, Site } from '@/domain/types';

/** The half-open interval from the start of `firstNight` to the end of `lastNight`, both observing nights. */
export const overNights = (site: Site, firstNight: string, lastNight: string): TimestampIntervalItem => ({
  __typename: 'TimestampInterval',
  start: new Date(observingNightInterval(site, firstNight).start).toISOString(),
  end: new Date(observingNightInterval(site, lastNight).end).toISOString(),
});

type InstrumentAvailabilityBlockParams = Partial<Omit<InstrumentAvailabilityBlockItem, '__typename' | 'location'>> &
  Pick<InstrumentAvailabilityBlockItem, 'instrument' | 'interval'> & {
    readonly at:
      { readonly port: number; readonly place?: never } | { readonly place: OffPortPlace; readonly port?: never };
  };

export const instrumentAvailabilityBlock = ({
  instrument,
  interval,
  at,
  publishedName = instrument,
  usage = 'SCIENCE',
  note = null,
}: InstrumentAvailabilityBlockParams): InstrumentAvailabilityBlockItem => ({
  __typename: 'InstrumentAvailabilityBlock',
  instrument,
  publishedName,
  usage,
  note,
  interval,
  location:
    at.port !== undefined
      ? { __typename: 'InstrumentLocation', place: 'PORT', port: at.port }
      : { __typename: 'InstrumentLocation', place: at.place, port: null },
});

type TelescopeAvailabilityBlockParams = Partial<Omit<TelescopeAvailabilityBlockItem, '__typename'>> &
  Pick<TelescopeAvailabilityBlockItem, 'interval'>;

type TooSupportBlockParams = Partial<Omit<TooSupportBlockItem, '__typename'>> & Pick<TooSupportBlockItem, 'interval'>;

type TelescopeModeBlockParams = Partial<Omit<TelescopeModeBlockItem, '__typename'>> &
  Pick<TelescopeModeBlockItem, 'interval'>;

/** `port: null` is the whole telescope. */
export const telescopeAvailabilityBlock = ({
  interval,
  availability = 'OPEN',
  port = null,
  reason = null,
}: TelescopeAvailabilityBlockParams): TelescopeAvailabilityBlockItem => ({
  __typename: 'TelescopeAvailabilityBlock',
  availability,
  port,
  reason,
  interval,
});

export const telescopeClosure = (params: TelescopeAvailabilityBlockParams): TelescopeAvailabilityBlockItem =>
  telescopeAvailabilityBlock({ availability: 'CLOSED', ...params });

export const tooSupportBlock = ({
  interval,
  tooSupport = 'STANDARD',
  note = null,
}: TooSupportBlockParams): TooSupportBlockItem => ({
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
}: TelescopeModeBlockParams): TelescopeModeBlockItem => ({
  __typename: 'TelescopeModeBlock',
  mode,
  programReferences,
  partner,
  note,
  interval,
});

type TelescopeNightParams = Pick<TelescopeNightItem, 'observingNight'> &
  Partial<Pick<TelescopeNightItem, 'dataAvailable'>>;

export const telescopeNight = ({ observingNight, dataAvailable = true }: TelescopeNightParams): TelescopeNightItem => ({
  __typename: 'TelescopeNight',
  observingNight,
  dataAvailable,
});
