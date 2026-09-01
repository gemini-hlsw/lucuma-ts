import type {
  ClosureFieldsFragment,
  ComponentBrowserQuery,
  InstrumentBlockFieldsFragment,
  ModeBlockFieldsFragment,
  NightComponentFieldsFragment,
  PublishedSemestersQuery,
  SubsystemBlockFieldsFragment,
  TooBlockFieldsFragment,
} from '@gql/gen/graphql';

import { addDays } from './semester';
import type {
  Closure,
  ComponentBlock,
  ComponentRecord,
  ModeBlock,
  Mounting,
  OffPortPlace,
  PublishedSemester,
  SubsystemBlock,
  TooBlock,
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
  location: InstrumentBlockFieldsFragment['location'],
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

export const toMountings = (blocks: readonly InstrumentBlockFieldsFragment[]): readonly Mounting[] =>
  blocks.map((block, index) => ({
    id: rowKey('m', index),
    instrument: block.instrument,
    publishedName: block.publishedName,
    usage: block.usage,
    ...toLocation(block.location, block.publishedName, block.interval),
    interval: toInterval(block.interval),
    note: block.note ?? null,
  }));

export const toClosures = (blocks: readonly ClosureFieldsFragment[]): readonly Closure[] =>
  blocks.map((block, index) => ({
    id: rowKey('c', index),
    availability: block.availability,
    port: block.port ?? null,
    interval: toInterval(block.interval),
    reason: block.reason ?? null,
  }));

export const toTooBlocks = (blocks: readonly TooBlockFieldsFragment[]): readonly TooBlock[] =>
  blocks.map((block, index) => ({
    id: rowKey('t', index),
    tooSupport: block.tooSupport,
    interval: toInterval(block.interval),
    note: block.note ?? null,
  }));

export const toModeBlocks = (blocks: readonly ModeBlockFieldsFragment[]): readonly ModeBlock[] =>
  blocks.map((block, index) => ({
    id: rowKey('d', index),
    mode: block.mode,
    programReferences: block.programReferences,
    partner: block.partner ?? null,
    interval: toInterval(block.interval),
    note: block.note ?? null,
  }));

export const toSubsystemBlocks = (blocks: readonly SubsystemBlockFieldsFragment[]): readonly SubsystemBlock[] =>
  blocks.map((block, index) => ({
    id: rowKey('s', index),
    subsystem: block.subsystem,
    usage: block.usage,
    powerSource: block.powerSource ?? null,
    interval: toInterval(block.interval),
    note: block.note ?? null,
  }));

export const toComponents = (data: ComponentBrowserQuery): readonly ComponentRecord[] =>
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
  readonly components: readonly ComponentRecord[];
  readonly blocks: readonly ComponentBlock[];
}

/** The night view feeds the one finder rather than growing its own row shape. */
export const toNightComponents = (blocks: readonly NightComponentFieldsFragment[]): NightComponents => {
  const byId = new Map<string, ComponentRecord>();
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
      id: rowKey('k', index),
      componentId: block.component.id,
      usage: block.usage,
      location: block.location,
      interval: toInterval(block.interval),
      note: block.note ?? null,
    })),
  };
};

export const toComponentBlocks = (data: ComponentBrowserQuery): readonly ComponentBlock[] =>
  data.instrumentComponentAvailability.map((block, index) => ({
    id: rowKey('k', index),
    componentId: block.component.id,
    usage: block.usage,
    location: block.location,
    interval: toInterval(block.interval),
    note: block.note ?? null,
  }));
