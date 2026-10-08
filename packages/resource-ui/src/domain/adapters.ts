import type { ComponentBrowserQuery, PublishedSemestersQuery } from '@gql/gen/graphql';
import type {
  InstrumentAvailabilityBlockItem,
  InstrumentComponentAvailabilityBlockItem,
  InstrumentLocationItem,
  TelescopeAvailabilityBlockItem,
  TelescopeModeBlockItem,
  TelescopeSubsystemAvailabilityBlockItem,
  TooSupportBlockItem,
} from '@gql/types';

import { addDays } from './semester';
import type {
  InstrumentAvailabilityBlock,
  InstrumentComponent,
  InstrumentComponentAvailabilityBlock,
  OffPortPlace,
  PublishedSemester,
  TelescopeAvailabilityBlock,
  TelescopeModeBlock,
  TelescopeSubsystemAvailabilityBlock,
  TooSupportBlock,
} from './types';

interface ApiInterval {
  readonly start: string;
  readonly end: string;
}

const toInterval = (interval: ApiInterval): { start: number; end: number } => ({
  start: Date.parse(interval.start),
  end: Date.parse(interval.end),
});

/** Position in the response, not an identity; a prefix must be unique per combined rendering context. */
const rowKey = (kind: string, index: number): string => `${kind}${String(index)}`;

export const toPublishedSemesters = (data: PublishedSemestersQuery): readonly PublishedSemester[] =>
  data.publishedSemesters.map((entry) => ({
    site: entry.site,
    semester: entry.semester,
    title: entry.title,
    version: entry.version ?? null,
    demo: entry.demo,
    // The API states a semester's nights half-open; the domain reads them inclusively.
    firstNight: entry.nights.start,
    lastNight: addDays(entry.nights.end, -1),
    holidays: entry.holidays,
    moonEvents: entry.moonEvents.map((event) => ({ date: event.date, phase: event.phase })),
  }));

/** Never cleared: a session that fixes the server and refetches gets silence, the wanted direction. */
const warnedInstruments = new Set<string>();

/** The one place the port/place promise is checked; a contradictory record reads UNKNOWN, never throws. */
const toLocation = (
  location: InstrumentLocationItem,
  publishedName: string,
  interval: ApiInterval,
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

export const toTelescopeSubsystemAvailability = (
  blocks: readonly TelescopeSubsystemAvailabilityBlockItem[],
): readonly TelescopeSubsystemAvailabilityBlock[] =>
  blocks.map((block, index) => ({
    id: rowKey('tsa', index),
    subsystem: block.subsystem,
    usage: block.usage,
    powerSource: block.powerSource ?? null,
    interval: toInterval(block.interval),
    note: block.note ?? null,
  }));

export const toComponents = (data: ComponentBrowserQuery): readonly InstrumentComponent[] =>
  data.components.map((component) => ({
    id: component.id,
    instrument: component.instrument,
    componentType: component.componentType,
    code: component.code,
    name: component.name,
    barcode: component.barcode ?? null,
    aliases: component.aliases,
  }));

/** The night projection's component blocks, with the identity of each piece lifted out beside them. */
export interface NightComponents {
  /** The pieces recorded tonight, deduplicated, in catalog order. */
  readonly components: readonly InstrumentComponent[];
  readonly blocks: readonly InstrumentComponentAvailabilityBlock[];
}

/** The night view feeds the one finder rather than growing its own row shape. */
export const toNightComponents = (blocks: readonly InstrumentComponentAvailabilityBlockItem[]): NightComponents => {
  const byId = new Map<string, InstrumentComponent>();
  for (const block of blocks) {
    byId.set(block.component.id, {
      id: block.component.id,
      instrument: block.component.instrument,
      componentType: block.component.componentType,
      code: block.component.code,
      name: block.component.name,
      barcode: block.component.barcode ?? null,
      aliases: block.component.aliases,
    });
  }
  const components = [...byId.values()].sort(
    (a, b) =>
      a.instrument.localeCompare(b.instrument) ||
      a.componentType.localeCompare(b.componentType) ||
      a.name.localeCompare(b.name),
  );
  return {
    components,
    blocks: blocks.map((block, index) => ({
      id: rowKey('ica', index),
      componentId: block.component.id,
      usage: block.usage,
      location: block.location,
      interval: toInterval(block.interval),
      note: block.note ?? null,
    })),
  };
};

export const toComponentAvailability = (data: ComponentBrowserQuery): readonly InstrumentComponentAvailabilityBlock[] =>
  data.instrumentComponentAvailability.map((block, index) => ({
    id: rowKey('ica', index),
    componentId: block.component.id,
    usage: block.usage,
    location: block.location,
    interval: toInterval(block.interval),
    note: block.note ?? null,
  }));
