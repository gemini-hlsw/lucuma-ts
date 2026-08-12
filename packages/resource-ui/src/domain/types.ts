/**
 * UI domain models.
 *
 * Derived from the generated GraphQL types rather than re-declared, so a schema
 * change surfaces as a compile error instead of drifting silently.
 */
import type {
  ComponentLocation,
  Instrument,
  InstrumentComponentType,
  Partner,
  ResourceUsage,
  Site,
  TelescopeAvailability,
  TelescopeModeType,
  TooSupport,
} from '@gql/gen/graphql';

// ComponentLocation: INSTALLED means "wherever the instrument is" and resolves
// through the instrument's own records (domain/componentFinder.ts), so a piece
// can never claim a port its instrument is not on.
export type {
  ComponentLocation,
  Instrument,
  Partner,
  ResourceUsage,
  Site,
  TelescopeAvailability,
  TelescopeModeType,
  TooSupport,
};

/** A half-open interval, start inclusive and end exclusive, as epoch milliseconds. */
export interface Interval {
  readonly start: number;
  readonly end: number;
}

/** An instrument on a port (or usable, at Gemini North) over an interval. */
export interface Mounting {
  readonly id: string;
  readonly instrument: Instrument;
  /** The name exactly as the schedule prints it, e.g. "cal/ZORRO". */
  readonly publishedName: string;
  /** The row the schedule files this under: "Port 3" at GS, "GMOS" at GN. */
  readonly rowLabel: string;
  /** What the mounted instrument can be used for over this span. */
  readonly usage: ResourceUsage;
  /** Port number, or null where the schedule does not organise by port. */
  readonly port: number | null;
  readonly interval: Interval;
  readonly note: string | null;
}

/** The telescope's (or one port's) recorded availability over a span - the
 * workbook records "Open" as explicitly as "Closed", so both are facts. */
export interface Closure {
  readonly id: string;
  readonly availability: TelescopeAvailability;
  /** The port that closed, or null when the whole telescope did. */
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

/** The telescope's operating mode over a span. */
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

/** A site + semester Resource holds a schedule for. */
export interface PublishedSemester {
  readonly site: Site;
  readonly semester: string;
  readonly title: string;
  readonly version: string | null;
  /** True for a synthetic schedule that was never published - the pickers must say so. */
  readonly demo: boolean;
  readonly firstNight: string;
  readonly lastNight: string;
  /** Ports at Gemini South, instruments at Gemini North. */
  readonly rowLabels: readonly string[];
  /**
   * Public holidays the sheet marks, ISO dates. Empty at Gemini North, which
   * publishes none - a site convention rather than missing data.
   */
  readonly holidays: readonly string[];
  /** New and full moons as the sheet prints them, not as we compute them. */
  readonly moonEvents: readonly MoonEvent[];
}

/** A new or full moon, printed on the published sheet. */
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
