import type {
  InstrumentAvailabilityBlockItem,
  InstrumentComponentAvailabilityBlockItem,
  InstrumentComponentItem,
  InstrumentLocationItem,
  PublishedSemesterItem,
  ScheduleSpan,
  TelescopeAvailabilityBlockItem,
  TelescopeModeBlockItem,
  TimestampIntervalItem,
  TooSupportBlockItem,
} from '@gql/types';

import { addDays } from './semester';
import type {
  InstrumentAvailabilityBlock,
  InstrumentComponent,
  InstrumentComponentAvailabilityBlock,
  Interval,
  OffPortPlace,
  PublishedSemester,
  TelescopeAvailabilityBlock,
  TelescopeModeBlock,
  TooSupportBlock,
} from './types';

/** The interval as the API states it: ISO instants, not epoch millis. */
export const toScheduleSpan = (interval: Interval): ScheduleSpan => ({
  start: new Date(interval.start).toISOString(),
  end: new Date(interval.end).toISOString(),
});

const toInterval = (interval: TimestampIntervalItem): Interval => ({
  start: Date.parse(interval.start),
  end: Date.parse(interval.end),
});

/** Position in the response, not an identity; a prefix must be unique per combined rendering context. */
const rowKey = (kind: string, index: number): string => `${kind}${String(index)}`;

export const toPublishedSemesters = (semesters: readonly PublishedSemesterItem[]): readonly PublishedSemester[] =>
  semesters.map((entry) => ({
    site: entry.site,
    semester: entry.semester,
    // The API states a semester's nights half-open; the domain reads them inclusively.
    firstNight: entry.nights.start,
    lastNight: addDays(entry.nights.end, -1),
  }));

/** Never cleared: a session that fixes the server and refetches gets silence, the wanted direction. */
const warnedInstruments = new Set<string>();

/** The one place the port/place promise is checked; a contradictory record reads UNKNOWN, never throws. */
const toLocation = (
  location: InstrumentLocationItem,
  publishedName: string,
  interval: TimestampIntervalItem,
): { port: number | null; place: OffPortPlace | null } => {
  if (location.place !== 'PORT') {
    return { port: null, place: location.place };
  }
  if (location.port === null) {
    if (import.meta.env.DEV && !warnedInstruments.has(publishedName)) {
      warnedInstruments.add(publishedName);
      console.warn(
        `Resource API: ${publishedName} is on place PORT with no port number, over ` +
          `${interval.start}..${interval.end}. Reading it as off-port; the server owes ` +
          `a port number exactly when place is PORT.`,
      );
    }
    return { port: null, place: 'UNKNOWN' };
  }
  return { port: location.port, place: null };
};

export const toInstrumentAvailability = (
  blocks: readonly InstrumentAvailabilityBlockItem[],
): readonly InstrumentAvailabilityBlock[] =>
  blocks.map((block, index) => ({
    id: rowKey('ia', index),
    instrument: block.instrument,
    publishedName: block.publishedName,
    usage: block.usage,
    ...toLocation(block.location, block.publishedName, block.interval),
    interval: toInterval(block.interval),
    note: block.note ?? null,
  }));

export const toTelescopeAvailability = (
  blocks: readonly TelescopeAvailabilityBlockItem[],
): readonly TelescopeAvailabilityBlock[] =>
  blocks.map((block, index) => ({
    id: rowKey('ta', index),
    availability: block.availability,
    port: block.port ?? null,
    interval: toInterval(block.interval),
    reason: block.reason ?? null,
  }));

export const toTooSupport = (blocks: readonly TooSupportBlockItem[]): readonly TooSupportBlock[] =>
  blocks.map((block, index) => ({
    id: rowKey('ts', index),
    tooSupport: block.tooSupport,
    interval: toInterval(block.interval),
    note: block.note ?? null,
  }));

export const toTelescopeMode = (blocks: readonly TelescopeModeBlockItem[]): readonly TelescopeModeBlock[] =>
  blocks.map((block, index) => ({
    id: rowKey('tm', index),
    mode: block.mode,
    programReferences: block.programReferences,
    partner: block.partner ?? null,
    interval: toInterval(block.interval),
    note: block.note ?? null,
  }));

export const toComponents = (components: readonly InstrumentComponentItem[]): readonly InstrumentComponent[] =>
  components.map((component) => ({
    id: component.id,
    instrument: component.instrument,
    componentType: component.componentType,
    code: component.code,
    name: component.name,
    barcode: component.barcode ?? null,
    aliases: component.aliases,
  }));

export const toComponentAvailability = (
  blocks: readonly InstrumentComponentAvailabilityBlockItem[],
): readonly InstrumentComponentAvailabilityBlock[] =>
  blocks.map((block, index) => ({
    id: rowKey('ica', index),
    componentId: block.component.id,
    usage: block.usage,
    location: block.location,
    interval: toInterval(block.interval),
    note: block.note ?? null,
  }));
