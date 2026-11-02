import { portRowLabel, TELESCOPE_PORTS } from '@/domain/ports';
import { observingNightInterval } from '@/domain/siteTime';
import {
  EMPTY_SCHEDULE,
  type InstrumentAvailabilityBlock,
  type InstrumentComponent,
  type Interval,
  type Schedule,
  type Site,
  type TelescopeAvailabilityBlock,
  type TelescopeModeBlock,
  type TooSupportBlock,
} from '@/domain/types';

/** A schedule holding only the lists a test names. */
export const scheduleOf = (over: Partial<Schedule> = {}): Schedule => ({ ...EMPTY_SCHEDULE, ...over });

/** [start of the observing night labelled `first`, end of the one labelled `last`). */
export const nightsSpan = (site: Site, first: string, last: string): Interval => ({
  start: observingNightInterval(site, first).start,
  end: observingNightInterval(site, last).end,
});

/** Every month draws the telescope's ports, whatever the semester holds. */
export const PORT_ROW_LABELS: readonly string[] = TELESCOPE_PORTS.map(portRowLabel);

export const domainInstrumentBlock = ({
  interval,
  id = 'ia0',
  instrument = 'GMOS',
  publishedName = instrument,
  usage = 'SCIENCE',
  port = 1,
  place = null,
  note = null,
}: Pick<InstrumentAvailabilityBlock, 'interval'> &
  Partial<InstrumentAvailabilityBlock>): InstrumentAvailabilityBlock => ({
  id,
  instrument,
  publishedName,
  usage,
  port,
  place,
  interval,
  note,
});

type TelescopeAvailabilityBlockParams = Pick<TelescopeAvailabilityBlock, 'interval'> &
  Partial<TelescopeAvailabilityBlock>;

export const domainTelescopeBlock = ({
  interval,
  id = 'ta0',
  availability = 'OPEN',
  port = null,
  reason = null,
}: TelescopeAvailabilityBlockParams): TelescopeAvailabilityBlock => ({
  id,
  availability,
  port,
  interval,
  reason,
});

export const domainTelescopeClosure = (params: TelescopeAvailabilityBlockParams): TelescopeAvailabilityBlock =>
  domainTelescopeBlock({ availability: 'CLOSED', ...params });

export const domainTooSupportBlock = ({
  interval,
  id = 'too0',
  tooSupport = 'STANDARD',
  note = null,
}: Pick<TooSupportBlock, 'interval'> & Partial<TooSupportBlock>): TooSupportBlock => ({
  id,
  tooSupport,
  interval,
  note,
});

export const domainTelescopeModeBlock = ({
  interval,
  id = 'mode0',
  mode = 'QUEUE',
  programReferences = [],
  partner = null,
  note = null,
}: Pick<TelescopeModeBlock, 'interval'> & Partial<TelescopeModeBlock>): TelescopeModeBlock => ({
  id,
  mode,
  programReferences,
  partner,
  interval,
  note,
});

export const domainInstrumentComponent = ({
  id = 'k-gs-R400_G5325',
  instrument = 'GMOS',
  componentType = 'DISPERSER',
  code = 'R400_G5325',
  name = 'R400',
  barcode = null,
  aliases = [],
}: Partial<InstrumentComponent> = {}): InstrumentComponent => ({
  id,
  instrument,
  componentType,
  code,
  name,
  barcode,
  aliases,
});
