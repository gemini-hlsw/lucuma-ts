import type {
  ComponentLocation,
  Instrument,
  InstrumentComponentType,
  InstrumentPlace,
  Partner,
  PowerSource,
  ResourceUsage,
  Site,
  TelescopeAvailability,
  TelescopeModeType,
  TelescopeSubsystem,
  TooSupport,
} from '@gql/gen/graphql';

// INSTALLED resolves through the instrument's own records, so a piece cannot claim a port it is not on.
export type {
  ComponentLocation,
  Instrument,
  InstrumentPlace,
  Partner,
  PowerSource,
  ResourceUsage,
  Site,
  TelescopeAvailability,
  TelescopeModeType,
  TelescopeSubsystem,
  TooSupport,
};

/** Exclusive with `Mounting.port`, so a phantom PORT place is unrepresentable off a port. */
export type OffPortPlace = Exclude<InstrumentPlace, 'PORT'>;

/** A fact about Gemini, not about the data: deriving it from the schedules left the control blank. */
export const SITES = ['GN', 'GS'] as const satisfies readonly Site[];

/** A half-open interval, start inclusive and end exclusive, as epoch milliseconds. */
export interface Interval {
  readonly start: number;
  readonly end: number;
}

/** `id` is the adapter's row key, not the API's: a block is a projection, so it carries no identity. */
export interface Mounting {
  readonly id: string;
  readonly instrument: Instrument;
  /** The name exactly as the schedule prints it, e.g. "cal/ZORRO". */
  readonly publishedName: string;
  /** What the mounted instrument can be used for over this span. */
  readonly usage: ResourceUsage;
  /** Null when not on a port. This alone says which schedule row the run draws on (domain/ports.ts). */
  readonly port: number | null;
  /** Non-null exactly when `port` is null. Usually UNKNOWN: the workbook records no place. */
  readonly place: OffPortPlace | null;
  readonly interval: Interval;
  readonly note: string | null;
}

/** The workbook records "Open" as explicitly as "Closed", so both are facts. */
export interface Closure {
  readonly id: string;
  readonly availability: TelescopeAvailability;
  /** The port this record is about, or null when it is the whole telescope. */
  readonly port: number | null;
  readonly interval: Interval;
  readonly reason: string | null;
}

/** The ToO support level over a span. NONE is a recorded fact, not an absence. */
export interface TooBlock {
  readonly id: string;
  readonly tooSupport: TooSupport;
  readonly interval: Interval;
  readonly note: string | null;
}

export interface ModeBlock {
  readonly id: string;
  readonly mode: TelescopeModeType;
  /** The programs a CLASSICAL or PRIORITY_VISITOR span is for, when any are named. */
  readonly programReferences: readonly string[];
  /** The partner a BLOCK_SCHEDULING span belongs to. Non-null exactly then. */
  readonly partner: Partner | null;
  readonly interval: Interval;
  readonly note: string | null;
}

export interface SubsystemBlock {
  readonly id: string;
  readonly subsystem: TelescopeSubsystem;
  readonly usage: ResourceUsage;
  /** Recorded when operations state it; the workbook carries none. */
  readonly powerSource: PowerSource | null;
  readonly interval: Interval;
  readonly note: string | null;
}

/** A site + semester Resource holds a schedule for. */
export interface PublishedSemester {
  readonly site: Site;
  readonly semester: string;
  readonly title: string;
  readonly version: string | null;
  /** True for a synthetic schedule that was never published - the pickers must say so. */
  readonly demo: boolean;
  /** Both ends inclusive; the API states the range half-open and `toPublishedSemesters` converts. */
  readonly firstNight: string;
  readonly lastNight: string;
  /** An empty list is a source that marks none, not missing data. */
  readonly holidays: readonly string[];
  /** New and full moons as the sheet prints them, not as we compute them. */
  readonly moonEvents: readonly MoonEvent[];
}

export interface MoonEvent {
  readonly date: string;
  readonly phase: 'NEW' | 'FULL';
}

/** One operational-state value, as everywhere in Resource. */
export type ComponentUsage = ResourceUsage;

export type ComponentType = InstrumentComponentType;

/** An instrument piece's identity - the ICTD catalog half. */
export interface ComponentRecord {
  readonly id: string;
  readonly instrument: Instrument;
  readonly componentType: ComponentType;
  readonly code: string;
  readonly name: string;
  /** Mask barcode when applicable; a mask's barcode doubles as its code. */
  readonly barcode: string | null;
  readonly aliases: readonly string[];
}

/** A span of a piece's life: where it was and whether it was usable. */
export interface ComponentBlock {
  readonly id: string;
  readonly componentId: string;
  readonly usage: ComponentUsage;
  readonly location: ComponentLocation;
  readonly interval: Interval;
  readonly note: string | null;
}
