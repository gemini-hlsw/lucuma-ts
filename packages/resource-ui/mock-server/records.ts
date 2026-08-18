/**
 * The record types the mock stores and serves - the shape every schedule
 * reduces to, and the shape of the `data/*.json` files `seed.ts` loads.
 *
 * These came from the operations workbook export
 * (`fixtures/telescope_schedules.xlsx`). The reader that produced them lived in
 * `mock-server/import/` and was removed on 2026-08-14: operations will not send
 * another export, so the generated JSON *is* the source now and an unmaintained
 * spreadsheet dependency bought nothing. The script is preserved on the
 * `resource/workbook-importer` branch if an Excel import is ever needed again.
 *
 * Two standing rules the records are held to:
 *
 * - **Intervals, never dates.** Every block resolves to a `[start, end)` instant
 *   pair through the observing-night convention, so a partial night is just an
 *   interval that does not land on a night boundary. The source's own dates are
 *   kept verbatim beside them as ground truth.
 * - **A gap means "not recorded".** A night the source left empty produces no
 *   block at all. It must never become an `UNAVAILABLE` record.
 *
 * The vocabularies below are **the schema's own enums**, imported rather than
 * restated, so a value the SDL renames is a compile error here instead of a
 * record the API refuses at serve time. This is the one place `mock-server/`
 * reaches into `src/`, and only for types - `src/gql/gen/` is generated and
 * gitignored, so typechecking the mock depends on codegen having run, which
 * `prebuild` and CI already do. The imports are type-only, so node's type
 * stripping removes them and nothing loads out of `src/` at runtime.
 */
import type {
  Instrument as SchemaInstrument,
  InstrumentPlace,
  Partner,
  ResourceUsage,
  TelescopeModeType as SchemaTelescopeModeType,
  TelescopeSubsystem,
  TooSupport,
} from '../src/gql/gen/graphql.ts';

export type ImportSite = 'GN' | 'GS';

/**
 * What a schedule record can name: every instrument the schema names except
 * UNKNOWN, which is not an identification. An unidentified run carries
 * `instrument: null` with `kind: 'UNKNOWN'` - one statement that the run is
 * unidentified, rather than two.
 */
export type Instrument = Exclude<SchemaInstrument, 'UNKNOWN'>;

/**
 * A record's operational state - the API's `ResourceUsage`, one enum covering
 * both availability and what an available span is committed to.
 */
export type ImportedUsage = ResourceUsage;

/** Where an instrument is, as the API names it - `PORT` included. */
export type { InstrumentPlace };

/**
 * Where an instrument sits when it is on no port: every place except the one
 * that carries a port number.
 *
 * `src/domain/types.ts` declares this same `Exclude` for the app side, and the
 * duplication is deliberate. It is not a convention that keeps the mock from
 * importing the domain module - it is that `src/domain/types.ts` imports through
 * the `@gql/*` alias, and `tsconfig.node.json` (which covers `mock-server/` for
 * eslint and for the node dev server) declares no `paths`, so a mock-server file
 * importing it would fail to resolve `@gql/*` both at typecheck and at runtime
 * under node's type stripping. This file reaches the generated enum by relative
 * path instead, which is why the two declarations derive from one source
 * without either importing the other.
 */
export type OffPortPlace = Exclude<InstrumentPlace, 'PORT'>;

/** The ToO support levels the API names. */
export type TooSupportLevel = TooSupport;

/** The operating modes the API names. */
export type TelescopeModeType = SchemaTelescopeModeType;

/** A Gemini partner tag, as lucuma-core enumerates them. */
export type PartnerTag = Partner;

/**
 * The subsystems the records name - narrowed from the schema's own list rather
 * than restated, so a rename there is a compile error here. The rest of the
 * schema's subsystems await entered data.
 */
export type SubsystemName = Extract<TelescopeSubsystem, 'PWFS1' | 'PWFS2' | 'LGS'>;

/**
 * How to read a source date.
 *
 * `EVENING` - the night is labelled by the evening it begins, so a date of the
 * 7th is the observing night ending on the 8th (the lucuma-core convention).
 * The workbook's "Local Date" column reads this way: both sites' data starts on
 * 2024-08-01, which is 2024B's first *evening* - under the other reading both
 * would begin on 2024A's final night, which no export would do.
 * `ENDING` - the source already labels by the date the night ends.
 */
export type NightLabelling = 'EVENING' | 'ENDING';

export type ImportedBlockKind =
  /** A resolved instrument on a port. `instrument` is set. */
  | 'MOUNTED'
  /**
   * A run whose instrument could not be resolved - a name the source uses that
   * is not in the instrument map. Kept, with any note, so it shows up as
   * something to ask about rather than vanishing.
   */
  | 'UNKNOWN'
  /** Source text that marks nothing as available. Never served. */
  | 'ANNOTATION';

export interface ImportedBlock {
  readonly kind: ImportedBlockKind;
  readonly site: ImportSite;
  /**
   * Port number when the run is on a port; null for an off-port usability run.
   *
   * This is the whole of where a run sits, and therefore the whole of which row
   * a schedule view draws it on - there is no separate row label, because the
   * label a view prints ("Port 3") is a rendering of this number.
   */
  readonly port: number | null;
  /** Resolved instrument. Non-null exactly when `kind` is MOUNTED. */
  readonly instrument: Instrument | null;
  /** The name as the source printed it, kept for tracing a resolution back. */
  readonly publishedName: string | null;
  /** Dates exactly as the source prints them. Ground truth; never re-derived. */
  readonly firstSheetDate: string;
  readonly lastSheetDate: string;
  /** Observing nights under the chosen labelling. */
  readonly firstObservingNight: string;
  readonly lastObservingNight: string;
  /** Half-open interval covering every night in the run, as UTC instants. */
  readonly start: string;
  readonly end: string;
  readonly note: string | null;
  /** The source's colour, where it had one. The workbook has none. */
  readonly background: string;
  /**
   * The instrument's recorded operational state over the run, from the
   * workbook's per-instrument usability column. Absent means SCIENCE - the
   * published sheets recorded nothing else.
   */
  readonly usage?: ImportedUsage;
}

/**
 * A span the whole telescope, or one port, was shut down for.
 *
 * The workbook states closures directly: `Telescope` = "Closed", with the
 * `Mode/Program` column carrying the reason ("Shutdown"). A port closes on its
 * own only in the superseded sheet sources; the workbook records a port with
 * nothing mounted as an empty cell, which stays a gap.
 */
export interface ImportedClosure {
  readonly site: ImportSite;
  /** The workbook's Telescope column: Open nights are records too, not gaps. */
  readonly availability: 'OPEN' | 'CLOSED';
  /** The port this applies to, or null for the whole telescope. */
  readonly port: number | null;
  readonly firstSheetDate: string;
  readonly lastSheetDate: string;
  readonly firstObservingNight: string;
  readonly lastObservingNight: string;
  readonly start: string;
  readonly end: string;
  /** Whatever the source printed as the reason, when it printed any. */
  readonly reason: string | null;
}

/**
 * The ToO support level over a span, from the workbook's `ToOs` column.
 * A gap still means "not recorded"; `NONE` is a recorded fact.
 */
export interface ImportedTooSupport {
  readonly site: ImportSite;
  readonly start: string;
  readonly end: string;
  readonly tooSupport: TooSupportLevel;
  readonly note: string | null;
}

/** A subsystem's operational state over a span, from its workbook column. */
export interface ImportedSubsystem {
  readonly site: ImportSite;
  readonly subsystem: SubsystemName;
  readonly usage: ImportedUsage;
  readonly start: string;
  readonly end: string;
  readonly note: string | null;
}

/** The telescope's operating mode over a span, from `Mode/Program`. */
export interface ImportedTelescopeMode {
  readonly site: ImportSite;
  readonly start: string;
  readonly end: string;
  readonly mode: TelescopeModeType;
  /** The program a CLASSICAL or PRIORITY_VISITOR span is for, when named. */
  readonly programReferences: readonly string[];
  /** The partner a BLOCK_SCHEDULING span belongs to. The workbook records none. */
  readonly partner: PartnerTag | null;
  readonly note: string | null;
}

/** A colour-key entry, from the superseded sheet sources. The workbook has none. */
export interface LegendEntry {
  readonly label: string;
  readonly background: string;
}

/** A new or full moon as a source prints it. The workbook prints none. */
export interface PublishedMoonEvent {
  readonly date: string;
  readonly phase: 'NEW' | 'FULL';
}

export interface ImportedSchedule {
  readonly site: ImportSite;
  readonly semester: string;
  readonly title: string;
  readonly version: string | null;
  /**
   * True only on a hand-written schedule. The workbook records never set it:
   * parsed source data is an operations record, and the API serves this so a
   * consumer can keep invented records apart from real ones. No such schedule
   * ships today - the synthetic GS 2099B demo was removed when the workbook
   * became the one source.
   */
  readonly demo?: true;
  readonly nightLabelling: NightLabelling;
  readonly legend: readonly LegendEntry[];
  readonly blocks: readonly ImportedBlock[];
  readonly closures: readonly ImportedClosure[];
  /** ToO support and telescope mode records, from the workbook's columns. */
  readonly tooSupport?: readonly ImportedTooSupport[];
  readonly modes?: readonly ImportedTelescopeMode[];
  /** Subsystem records: the PWFS1, PWFS2 and LGS columns, nightly. */
  readonly subsystems?: readonly ImportedSubsystem[];
  /**
   * What a source says about the *nights* rather than the ports: public
   * holidays and printed moon dates. The workbook carries neither, so these
   * are empty - the calendar computes its own moon and shows no holidays.
   */
  readonly holidays: readonly string[];
  readonly moonEvents: readonly PublishedMoonEvent[];
  readonly warnings: readonly string[];
}
