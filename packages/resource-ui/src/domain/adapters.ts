/**
 * GraphQL responses -> UI domain models.
 *
 * The only place that touches generated fragment shapes. All null handling and
 * timestamp parsing lives here, so components never see either.
 *
 * The block adapters take the generated *fragment* types rather than a query
 * type, so the semester, week and night queries all feed the same two functions
 * and a schema change surfaces here once.
 */
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

/**
 * A row key for a block, made here because the API gives blocks no identity.
 *
 * Every query clips its records to the window asked for, so a block is a
 * projection rather than an entity and `ScheduleBlock` carries no `id` (the
 * SDL says why at length). A rendered row and a chart point still need a key,
 * and position within the response is one: stable for as long as the response
 * is, unique across kinds because each kind takes its own prefix, and
 * obviously not an identity - which is the point.
 *
 * The prefixes have to stay unique per *combined rendering context*, not merely
 * per function: `'k'` is deliberately shared by `toNightComponents` and
 * `toComponentBlocks` because those two feed disjoint lists (`src/gql/hooks.ts`).
 * A new kind whose rows could ever be rendered in one list alongside an existing
 * kind's needs its own letter.
 */
const rowKey = (kind: string, index: number): string => `${kind}${String(index)}`;

export const toPublishedSemesters = (data: PublishedSemestersQuery): readonly PublishedSemester[] =>
  data.publishedSemesters.map((entry) => ({
    site: entry.site,
    semester: entry.semester,
    title: entry.title,
    version: entry.version ?? null,
    demo: entry.demo,
    // The API states a semester's nights half-open; the domain reads them
    // inclusively, because every comparison in the app asks "is this night in
    // the semester". This one line is where the two meet.
    firstNight: entry.nights.start,
    lastNight: addDays(entry.nights.end, -1),
    holidays: entry.holidays,
    moonEvents: entry.moonEvents.map((event) => ({ date: event.date, phase: event.phase })),
  }));

/**
 * Instruments `toLocation` has already warned about, so the dev warning is one
 * line per broken instrument rather than one per record.
 *
 * Never cleared, deliberately: a session that fixes the server and refetches
 * then gets silence, which is the wanted direction. The warning's job is to be
 * noticed once, and a clearing set would repeat it on every refetch for as long
 * as the server stayed broken - the flood it exists to prevent.
 */
const warnedInstruments = new Set<string>();

/**
 * The API's `InstrumentLocation` -> the exclusive pair the domain reads.
 *
 * The wire type states `place` and `port` separately and promises they agree -
 * `port` non-null exactly when `place` is `PORT`. This is the one place the app
 * checks that promise rather than trusting it, and the one place a record that
 * breaks it is given a reading.
 *
 * A `PORT` with no port number reads as off-port with place UNKNOWN. UNKNOWN is
 * borrowed for it: this package defines UNKNOWN as a recorded fact rather than
 * an error (the SDL's `InstrumentPlace`, and `PLACE_LABEL` in
 * `instrumentFinder.ts`, which prints it as the plain "not on a port"), and
 * `InstrumentWhere.NOT_RECORDED` is the closer meaning but is a *kind* rather
 * than a place, which `Mounting` cannot carry without a reshape that an error
 * path does not earn. UNKNOWN is simply the only representable answer, so the
 * warning below is what separates a server bug from an ordinary observation.
 * Never a thrown error: one contradictory record must not empty a night.
 *
 * The warning names each instrument once, over the first interval it was seen
 * wrong on. A degraded server answering a semester prints one line per record
 * otherwise, per render and per refetch, which buries the console the warning
 * exists to be read in.
 */
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

/** The night projection's component blocks, with each piece's identity nested. */
export interface NightComponents {
  /** The pieces recorded tonight, deduplicated, in catalog order. */
  readonly components: readonly ComponentRecord[];
  readonly blocks: readonly ComponentBlock[];
}

/**
 * `TelescopeNight.components` -> the same two models the browser uses, so the
 * night view feeds the one finder rather than growing its own row shape.
 */
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
