/**
 * The record types the mock stores and serves - the shape every schedule
 * reduces to, whatever its source.
 *
 * Today the one source is the operations workbook export
 * (`fixtures/telescope_schedules.xlsx`, parsed by `workbook.ts`). The published
 * web overview sheets this package used to import are gone: the workbook is the
 * operations team's own record and supersedes them where they disagreed
 * (the 2026-08-09 validation pass found several such runs).
 *
 * Two standing rules:
 *
 * - **Intervals, never dates.** Every block resolves to a `[start, end)` instant
 *   pair through the observing-night convention, so a partial night is later
 *   just an interval that does not land on a night boundary. The source's own
 *   dates are kept verbatim beside them as ground truth.
 * - **A gap means "not recorded".** A night the source leaves empty produces no
 *   block at all. It must never become an `UNAVAILABLE` record.
 */
import type { Instrument } from './instruments.ts';

export type ImportSite = 'GN' | 'GS';

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
  /** The row's label, "Port 3" - the workbook organises both sites by port. */
  readonly rowLabel: string;
  /** Port number when the row is a port, else null. */
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
  readonly usage?: 'SCIENCE' | 'ENGINEERING' | 'UNAVAILABLE';
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

export type TooSupportLevel = 'STANDARD' | 'INTERRUPT' | 'RAPID' | 'NONE';

export type TelescopeModeType =
  'QUEUE' | 'CLASSICAL' | 'PRIORITY_VISITOR' | 'ENGINEERING' | 'COMMISSIONING' | 'SHUTDOWN' | 'BLOCK_SCHEDULING';

/** A Gemini partner tag, as lucuma-core enumerates them. */
export type PartnerTag = 'AR' | 'BR' | 'CA' | 'CL' | 'KR' | 'UH' | 'US';

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
   * True only on a hand-written schedule. The importer never sets it: parsed
   * source data is an operations record, and the API serves this so a consumer
   * can keep invented records apart from real ones. No such schedule ships
   * today - the synthetic GS 2099B demo was removed when the workbook became
   * the one source.
   */
  readonly demo?: true;
  readonly nightLabelling: NightLabelling;
  readonly legend: readonly LegendEntry[];
  readonly rowLabels: readonly string[];
  readonly blocks: readonly ImportedBlock[];
  readonly closures: readonly ImportedClosure[];
  /** ToO support and telescope mode records, from the workbook's columns. */
  readonly tooSupport?: readonly ImportedTooSupport[];
  readonly modes?: readonly ImportedTelescopeMode[];
  /**
   * What a source says about the *nights* rather than the ports: public
   * holidays and printed moon dates. The workbook carries neither, so these
   * are empty - the calendar computes its own moon and shows no holidays.
   */
  readonly holidays: readonly string[];
  readonly moonEvents: readonly PublishedMoonEvent[];
  readonly warnings: readonly string[];
}
