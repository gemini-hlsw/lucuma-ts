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

import type {
  Closure,
  ComponentBlock,
  ComponentRecord,
  ModeBlock,
  Mounting,
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

export const toPublishedSemesters = (data: PublishedSemestersQuery): readonly PublishedSemester[] =>
  data.publishedSemesters.map((entry) => ({
    site: entry.site,
    semester: entry.semester,
    title: entry.title,
    version: entry.version ?? null,
    demo: entry.demo,
    firstNight: entry.firstNight,
    lastNight: entry.lastNight,
    holidays: entry.holidays,
    moonEvents: entry.moonEvents.map((event) => ({ date: event.date, phase: event.phase })),
  }));

export const toMountings = (blocks: readonly InstrumentBlockFieldsFragment[]): readonly Mounting[] =>
  blocks.map((block) => ({
    id: block.id,
    instrument: block.instrument,
    publishedName: block.publishedName,
    usage: block.usage,
    port: block.location.port ?? null,
    locationType: block.location.type,
    interval: toInterval(block.interval),
    note: block.note ?? null,
  }));

export const toClosures = (blocks: readonly ClosureFieldsFragment[]): readonly Closure[] =>
  blocks.map((block) => ({
    id: block.id,
    availability: block.availability,
    port: block.port ?? null,
    interval: toInterval(block.interval),
    reason: block.reason ?? null,
  }));

export const toTooBlocks = (blocks: readonly TooBlockFieldsFragment[]): readonly TooBlock[] =>
  blocks.map((block) => ({
    id: block.id,
    tooSupport: block.tooSupport,
    interval: toInterval(block.interval),
    note: block.note ?? null,
  }));

export const toModeBlocks = (blocks: readonly ModeBlockFieldsFragment[]): readonly ModeBlock[] =>
  blocks.map((block) => ({
    id: block.id,
    mode: block.mode,
    programReferences: block.programReferences,
    partner: block.partner ?? null,
    interval: toInterval(block.interval),
    note: block.note ?? null,
  }));

export const toSubsystemBlocks = (blocks: readonly SubsystemBlockFieldsFragment[]): readonly SubsystemBlock[] =>
  blocks.map((block) => ({
    id: block.id,
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
    blocks: blocks.map((block) => ({
      id: block.id,
      componentId: block.component.id,
      usage: block.usage,
      location: block.location,
      interval: toInterval(block.interval),
      note: block.note ?? null,
    })),
  };
};

export const toComponentBlocks = (data: ComponentBrowserQuery): readonly ComponentBlock[] =>
  data.instrumentComponentAvailability.map((block) => ({
    id: block.id,
    componentId: block.component.id,
    usage: block.usage,
    location: block.location,
    interval: toInterval(block.interval),
    note: block.note ?? null,
  }));
