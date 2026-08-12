/**
 * Resolvers for the mock schema.
 *
 * One executable schema serves both the dev server (mock-server/server.ts) and
 * the browser tests (src/test/mockClient.ts via Apollo SchemaLink), so a test
 * and a manual click-through exercise the same code. Keep that property.
 *
 * Everything is derived from the imported schedules; nothing is stored per
 * night. A night is a projection - clip every record to the night's interval and
 * report what is left - which is what keeps partial nights working without a
 * special case (the partial-night non-negotiable).
 */
import { GraphQLError, GraphQLScalarType } from 'graphql';

import type { CatalogComponent, SynthesizedComponentBlock } from './components.ts';
import type { ImportSite } from './import/blocks.ts';
import type {
  MockStore,
  StoredBlock,
  StoredClosure,
  StoredSubsystem,
  StoredTelescopeMode,
  StoredTooSupport,
} from './store.ts';
import type { SynthesizedInstrumentBlock } from './storedInstruments.ts';
import { clipInterval, intervalsOverlap, type MockInterval, observingNightInterval } from './time.ts';

/** Above a semester, below an accidental decade (v1-scheduler-integration.md §4). */
const MAX_NIGHTS = 400;

/**
 * The ODB `Timestamp` scalar is ISO-8601 in the form "2011-12-03T10:15:30Z"
 * (OdbSchema.graphql). `Date.prototype.toISOString` always prints a millisecond
 * fraction and the imported fixtures carry one too, so a zero fraction is
 * trimmed here rather than left to drift from what the real service sends. A
 * genuine fraction is kept.
 */
const Timestamp = new GraphQLScalarType<string, string>({
  name: 'Timestamp',
  description: 'Timestamp of time in ISO-8601 representation, e.g. "2026-08-07T18:00:00Z".',
  serialize: (value) => String(value).replace(/\.0+Z$/, 'Z'),
  parseValue: (value) => String(value),
});

const addDays = (date: string, days: number): string => {
  const shifted = new Date(`${date}T00:00:00Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
};

/** Observing nights from `start` inclusive to `end` exclusive. */
const nightsBetween = (start: string, end: string): readonly string[] => {
  const nights: string[] = [];
  for (let night = start; night < end; night = addDays(night, 1)) {
    nights.push(night);
  }
  return nights;
};

/** Whole days from `start` inclusive to `end` exclusive, without building them. */
const nightCount = (start: string, end: string): number =>
  Math.max(0, Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000));

const intervalOf = (record: { start: string; end: string }): MockInterval => ({
  start: record.start,
  end: record.end,
});

const MICROS_PER = { hour: 3_600_000_000, minute: 60_000_000, second: 1_000_000, milli: 1_000 } as const;

/**
 * ISO-8601 duration, the form `java.time.Duration` prints and lucuma-core's
 * `TimeSpan.iso` carries: PT24H, PT1H30M, PT0.5S, PT0S.
 *
 * Intervals are half-open with `end` after `start` by construction, so no
 * negative case arises.
 */
const isoDuration = (microseconds: number): string => {
  const hours = Math.floor(microseconds / MICROS_PER.hour);
  const minutes = Math.floor((microseconds % MICROS_PER.hour) / MICROS_PER.minute);
  const seconds = (microseconds % MICROS_PER.minute) / MICROS_PER.second;
  const parts = [
    hours === 0 ? '' : `${String(hours)}H`,
    minutes === 0 ? '' : `${String(minutes)}M`,
    seconds === 0 ? '' : `${String(seconds)}S`,
  ].join('');
  return parts === '' ? 'PT0S' : `PT${parts}`;
};

const instrumentBlock = (block: StoredBlock, interval: MockInterval): unknown => ({
  id: block.id,
  site: block.site,
  interval,
  note: block.note,
  // An UNKNOWN block is a run the importer could not identify - an
  // unrecognised workbook name. Its printed text, when it has any, is in `note`.
  instrument: block.instrument ?? 'UNKNOWN',
  publishedName: block.publishedName ?? block.note ?? 'Unknown',
  location: { type: block.port === null ? 'UNKNOWN' : 'PORT', port: block.port },
  // The workbook's per-instrument usability column, where it recorded one;
  // SCIENCE otherwise - the sources never record a mounted instrument as
  // anything else without saying so.
  usage: block.usage ?? 'SCIENCE',
});

/**
 * A stored instrument, in the same shape a mounting answers in.
 *
 * `location` carries the place rather than a port, which is what tells a
 * consumer this is an instrument in storage rather than one on the telescope.
 */
const storedInstrumentBlock = (block: SynthesizedInstrumentBlock, interval: MockInterval): unknown => ({
  id: block.id,
  site: block.site,
  interval,
  note: block.note,
  instrument: block.instrument,
  publishedName: block.publishedName,
  location: { type: block.place, port: null },
  usage: block.usage,
});

const componentOf = (component: CatalogComponent): unknown => ({
  id: component.id,
  instrument: component.instrument,
  componentType: component.componentType,
  code: component.code,
  name: component.name,
  barcode: component.barcode,
  aliases: component.aliases,
  existence: component.existence,
});

const componentBlock = (store: MockStore, block: SynthesizedComponentBlock, interval: MockInterval): unknown => {
  const component = store.componentById(block.componentId);
  if (component === undefined) {
    // Unreachable while both sides come from the one catalog; loud if it stops.
    throw new GraphQLError(`Component block ${block.id} references an unknown component.`);
  }
  return {
    id: block.id,
    site: block.site,
    interval,
    note: block.note,
    component: componentOf(component),
    usage: block.usage,
    location: block.location,
  };
};

/** Case-insensitive match on any of a piece's published identities. */
const matchesSearch = (component: CatalogComponent, search: string): boolean => {
  const needle = search.toLowerCase();
  return [component.name, component.code, component.barcode ?? '', ...component.aliases].some((identity) =>
    identity.toLowerCase().includes(needle),
  );
};

const componentFilter =
  (instruments: readonly string[] | null | undefined, componentTypes: readonly string[] | null | undefined) =>
  (component: CatalogComponent): boolean =>
    (instruments === null || instruments === undefined || instruments.includes(component.instrument)) &&
    (componentTypes === null || componentTypes === undefined || componentTypes.includes(component.componentType));

const closureBlock = (closure: StoredClosure, interval: MockInterval): unknown => ({
  id: closure.id,
  site: closure.site,
  interval,
  note: null,
  availability: closure.availability,
  port: closure.port,
  reason: closure.reason,
});

const tooBlock = (record: StoredTooSupport, interval: MockInterval): unknown => ({
  id: record.id,
  site: record.site,
  interval,
  note: record.note,
  tooSupport: record.tooSupport,
});

const modeBlock = (record: StoredTelescopeMode, interval: MockInterval): unknown => ({
  id: record.id,
  site: record.site,
  interval,
  note: record.note,
  mode: record.mode,
  programReferences: record.programReferences,
  partner: record.partner,
});

const subsystemBlock = (record: StoredSubsystem, interval: MockInterval): unknown => ({
  id: record.id,
  site: record.site,
  interval,
  note: record.note,
  subsystem: record.subsystem,
  usage: record.usage,
  // The workbook records no power source; entered data may.
  powerSource: null,
});

/** Clips every record touching `bounds` to it, dropping those that miss. */
const clipAll = <T extends { start: string; end: string }>(
  records: readonly T[],
  bounds: MockInterval,
): readonly { record: T; interval: MockInterval }[] =>
  records.flatMap((record) => {
    const interval = clipInterval(intervalOf(record), bounds);
    return interval === null ? [] : [{ record, interval }];
  });

const nightProjection = (store: MockStore, site: ImportSite, observingNight: string): unknown => {
  const interval = observingNightInterval(site, observingNight);
  const mountings = clipAll(store.mountingsFor(site), interval);
  const stored = clipAll(store.storedInstrumentsFor(site), interval);
  const closures = clipAll(store.closuresFor(site), interval);
  const tooSupport = clipAll(store.tooSupportFor(site), interval);
  const modes = clipAll(store.modesFor(site), interval);
  const subsystems = clipAll(store.subsystemsFor(site), interval);
  const components = clipAll(store.componentBlocksFor(site), interval);

  return {
    site,
    observingNight,
    interval,
    // False means nothing has been recorded for this night - never "everything is
    // unavailable". A consumer must be able to tell those apart. The synthetic
    // component layer never decides this: it is derived from the schedules, so
    // counting it would let fake data turn an unrecorded night into a recorded one.
    dataAvailable:
      mountings.length > 0 || closures.length > 0 || tooSupport.length > 0 || modes.length > 0 || subsystems.length > 0,
    // The schedule's mountings, then the stored instruments - which never
    // count towards `dataAvailable` above, being synthetic.
    instrumentAvailability: [
      ...mountings.map(({ record, interval: clipped }) => instrumentBlock(record, clipped)),
      ...stored.map(({ record, interval: clipped }) => storedInstrumentBlock(record, clipped)),
    ],
    telescopeAvailability: closures.map(({ record, interval: clipped }) => closureBlock(record, clipped)),
    tooSupport: tooSupport.map(({ record, interval: clipped }) => tooBlock(record, clipped)),
    telescopeMode: modes.map(({ record, interval: clipped }) => modeBlock(record, clipped)),
    subsystems: subsystems.map(({ record, interval: clipped }) => subsystemBlock(record, clipped)),
    components: components.map(({ record, interval: clipped }) => componentBlock(store, record, clipped)),
  };
};

export const buildResolvers = (store: MockStore) => ({
  Timestamp,

  // `duration` is derived, never stored, so resolvers hand intervals around as
  // plain { start, end } and only pay for the unit conversions a query selects.
  TimestampInterval: {
    duration: (interval: MockInterval): { microseconds: number } => ({
      microseconds: (Date.parse(interval.end) - Date.parse(interval.start)) * MICROS_PER.milli,
    }),
  },

  TimeSpan: {
    microseconds: (span: { microseconds: number }): number => span.microseconds,
    milliseconds: (span: { microseconds: number }): number => span.microseconds / MICROS_PER.milli,
    seconds: (span: { microseconds: number }): number => span.microseconds / MICROS_PER.second,
    minutes: (span: { microseconds: number }): number => span.microseconds / MICROS_PER.minute,
    hours: (span: { microseconds: number }): number => span.microseconds / MICROS_PER.hour,
    iso: (span: { microseconds: number }): string => isoDuration(span.microseconds),
  },

  Query: {
    publishedSemesters: (): unknown =>
      store.state.schedules.map((schedule) => {
        const nights = [
          ...schedule.blocks.flatMap((block) => [block.firstObservingNight, block.lastObservingNight]),
          ...schedule.closures.flatMap((closure) => [closure.firstObservingNight, closure.lastObservingNight]),
        ].sort();
        return {
          site: schedule.site,
          semester: schedule.semester,
          title: schedule.title,
          version: schedule.version,
          demo: schedule.demo === true,
          firstNight: nights[0] ?? null,
          lastNight: nights.at(-1) ?? null,
          holidays: schedule.holidays,
          moonEvents: schedule.moonEvents,
        };
      }),

    telescopeNight: (_: unknown, args: { site: ImportSite; observingNight: string }): unknown =>
      nightProjection(store, args.site, args.observingNight),

    telescopeNights: (_: unknown, args: { site: ImportSite; nights: { start: string; end: string } }): unknown => {
      // A GraphQLError rather than an Error: graphql-yoga masks anything else as
      // "Unexpected error.", which would hide the bound from the very consumer
      // that has to stay under it.
      const requested = nightCount(args.nights.start, args.nights.end);
      if (requested > MAX_NIGHTS) {
        throw new GraphQLError(
          `telescopeNights supports at most ${String(MAX_NIGHTS)} nights; ${String(requested)} requested.`,
        );
      }
      return nightsBetween(args.nights.start, args.nights.end).map((night) => nightProjection(store, args.site, night));
    },

    instrumentAvailability: (
      _: unknown,
      args: { site: ImportSite; interval: MockInterval; clip: boolean },
    ): unknown => {
      const overlapping = <T extends { start: string; end: string }>(records: readonly T[]): readonly T[] =>
        records.filter((record) => intervalsOverlap(record.start, record.end, args.interval.start, args.interval.end));
      const touching = overlapping(store.mountingsFor(args.site));
      const stored = overlapping(store.storedInstrumentsFor(args.site));

      // clip: false returns stored intervals, so a view can draw a mounting that
      // runs past the edge of what it asked for.
      return args.clip
        ? [
            ...clipAll(touching, args.interval).map(({ record, interval }) => instrumentBlock(record, interval)),
            ...clipAll(stored, args.interval).map(({ record, interval }) => storedInstrumentBlock(record, interval)),
          ]
        : [
            ...touching.map((block) => instrumentBlock(block, intervalOf(block))),
            ...stored.map((block) => storedInstrumentBlock(block, intervalOf(block))),
          ];
    },

    components: (
      _: unknown,
      args: {
        site: ImportSite;
        instruments?: readonly string[] | null;
        componentTypes?: readonly string[] | null;
        search?: string | null;
        includeDeleted: boolean;
      },
    ): unknown =>
      store
        .componentsFor(args.site)
        .filter((component) => args.includeDeleted || component.existence !== 'DELETED')
        .filter(componentFilter(args.instruments, args.componentTypes))
        .filter(
          (component) => args.search === null || args.search === undefined || matchesSearch(component, args.search),
        )
        .map(componentOf),

    instrumentComponentAvailability: (
      _: unknown,
      args: {
        site: ImportSite;
        interval: MockInterval;
        clip: boolean;
        instruments?: readonly string[] | null;
        componentTypes?: readonly string[] | null;
      },
    ): unknown => {
      const keeps = componentFilter(args.instruments, args.componentTypes);
      const touching = store
        .componentBlocksFor(args.site)
        .filter((block) => {
          const component = store.componentById(block.componentId);
          return component !== undefined && keeps(component);
        })
        .filter((block) => intervalsOverlap(block.start, block.end, args.interval.start, args.interval.end));

      return args.clip
        ? clipAll(touching, args.interval).map(({ record, interval }) => componentBlock(store, record, interval))
        : touching.map((block) => componentBlock(store, block, intervalOf(block)));
    },

    telescopeAvailability: (_: unknown, args: { site: ImportSite; interval: MockInterval; clip: boolean }): unknown => {
      const touching = store
        .closuresFor(args.site)
        .filter((closure) => intervalsOverlap(closure.start, closure.end, args.interval.start, args.interval.end));

      return args.clip
        ? clipAll(touching, args.interval).map(({ record, interval }) => closureBlock(record, interval))
        : touching.map((closure) => closureBlock(closure, intervalOf(closure)));
    },

    tooSupport: (_: unknown, args: { site: ImportSite; interval: MockInterval; clip: boolean }): unknown => {
      const touching = store
        .tooSupportFor(args.site)
        .filter((record) => intervalsOverlap(record.start, record.end, args.interval.start, args.interval.end));

      return args.clip
        ? clipAll(touching, args.interval).map(({ record, interval }) => tooBlock(record, interval))
        : touching.map((record) => tooBlock(record, intervalOf(record)));
    },

    telescopeMode: (_: unknown, args: { site: ImportSite; interval: MockInterval; clip: boolean }): unknown => {
      const touching = store
        .modesFor(args.site)
        .filter((record) => intervalsOverlap(record.start, record.end, args.interval.start, args.interval.end));

      return args.clip
        ? clipAll(touching, args.interval).map(({ record, interval }) => modeBlock(record, interval))
        : touching.map((record) => modeBlock(record, intervalOf(record)));
    },

    telescopeSubsystemAvailability: (
      _: unknown,
      args: { site: ImportSite; interval: MockInterval; clip: boolean; subsystems?: readonly string[] | null },
    ): unknown => {
      const touching = store
        .subsystemsFor(args.site)
        .filter(
          (record) =>
            args.subsystems === null || args.subsystems === undefined || args.subsystems.includes(record.subsystem),
        )
        .filter((record) => intervalsOverlap(record.start, record.end, args.interval.start, args.interval.end));

      return args.clip
        ? clipAll(touching, args.interval).map(({ record, interval }) => subsystemBlock(record, interval))
        : touching.map((record) => subsystemBlock(record, intervalOf(record)));
    },
  },
});
