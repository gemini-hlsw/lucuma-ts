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

// ComponentLocation: INSTALLED means "wherever the instrument is" and resolves
// through the instrument's own records (domain/componentFinder.ts), so a piece
// can never claim a port its instrument is not on.
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

/**
 * Where an instrument sits when it is on no port: every `InstrumentPlace`
 * except the one that carries a port number.
 *
 * The wire type states `place` and `port` separately and promises they agree.
 * The domain holds that promise as a type instead: `Mounting.port` and
 * `Mounting.place` are exclusive, so nothing past the adapter can carry both,
 * and a phantom `PORT` place is unrepresentable off a port.
 *
 * `mock-server/records.ts` declares the same `Exclude` for the server side, and
 * says there why the two cannot share one declaration.
 */
export type OffPortPlace = Exclude<InstrumentPlace, 'PORT'>;

/**
 * The observatory's two sites, in the order the masthead offers them.
 *
 * A fact about Gemini, not about the data - the same reasoning as
 * `TELESCOPE_PORTS`. Deriving the site list from what the schedules happen to
 * hold left the masthead's Site control **blank** whenever the server answered
 * with nothing, which since the demo source went (2026-08-14) is the app's
 * whole state until the backend serves v1. `satisfies` keeps it honest: a site
 * added to the schema fails to compile until it is listed.
 */
export const SITES = ['GN', 'GS'] as const satisfies readonly Site[];

/** A half-open interval, start inclusive and end exclusive, as epoch milliseconds. */
export interface Interval {
  readonly start: number;
  readonly end: number;
}

/**
 * An instrument on a port, or recorded usable off one, over an interval.
 *
 * `id` is the adapter's own row key, not the API's: a block is a projection
 * onto the window that was asked for, so the API gives it no identity
 * (`ScheduleBlock` in the SDL says why). Unique within one response, which is
 * all a rendered row or a chart point needs.
 */
export interface Mounting {
  readonly id: string;
  readonly instrument: Instrument;
  /** The name exactly as the schedule prints it, e.g. "cal/ZORRO". */
  readonly publishedName: string;
  /** What the mounted instrument can be used for over this span. */
  readonly usage: ResourceUsage;
  /**
   * Port number, or null when the run is not on a port. This alone says which
   * schedule row the run draws on (`domain/ports.ts`); a null port draws on
   * none, and the instrument browser is where such a run is legible.
   */
  readonly port: number | null;
  /**
   * Where an off-port run physically sits - non-null **exactly** when `port` is
   * null. The API states place and port separately and promises they agree;
   * `toMountings` is where that promise is checked and turned into this
   * exclusive pair. Usually UNKNOWN: the workbook records an instrument usable
   * between mounts without saying where it was.
   */
  readonly place: OffPortPlace | null;
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

/** A telescope subsystem's operational state over a span. */
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
  /**
   * The semester's nights, **both ends inclusive** - the reading every date
   * comparison in this app uses (`firstNight <= night && night <= lastNight`).
   *
   * The API states the same range half-open, as `DateInterval`; `toPublishedSemesters`
   * is the one place the conversion happens.
   */
  readonly firstNight: string;
  readonly lastNight: string;
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
