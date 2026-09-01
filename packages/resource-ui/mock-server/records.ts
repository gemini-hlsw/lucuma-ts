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

/** UNKNOWN is not an identification: an unidentified run is `instrument: null` with `kind: 'UNKNOWN'`. */
export type Instrument = Exclude<SchemaInstrument, 'UNKNOWN'>;

export type ImportedUsage = ResourceUsage;

export type { InstrumentPlace };

/** Duplicated from `src/domain/types.ts`: mock-server has no `@gql/*` paths in tsconfig.node.json. */
export type OffPortPlace = Exclude<InstrumentPlace, 'PORT'>;

export type TooSupportLevel = TooSupport;

export type TelescopeModeType = SchemaTelescopeModeType;

export type PartnerTag = Partner;

/** Only these three of the schema's subsystems have entered data. */
export type SubsystemName = Extract<TelescopeSubsystem, 'PWFS1' | 'PWFS2' | 'LGS'>;

/** EVENING labels a night by the evening it begins (the lucuma-core convention); ENDING by the date it ends. */
export type NightLabelling = 'EVENING' | 'ENDING';

export type ImportedBlockKind =
  | 'MOUNTED'
  /** A name the instrument map does not resolve. Kept, so it reads as a question rather than a silent drop. */
  | 'UNKNOWN'
  /** Source text that marks nothing as available. Never served. */
  | 'ANNOTATION';

export interface ImportedBlock {
  readonly kind: ImportedBlockKind;
  readonly site: ImportSite;
  /** Null for an off-port run. This is the whole of which row a view draws it on; there is no row label. */
  readonly port: number | null;
  /** Non-null exactly when `kind` is MOUNTED. */
  readonly instrument: Instrument | null;
  readonly publishedName: string | null;
  /** Exactly as the source prints them: ground truth, never re-derived. */
  readonly firstSheetDate: string;
  readonly lastSheetDate: string;
  /** Under the schedule's `nightLabelling`. */
  readonly firstObservingNight: string;
  readonly lastObservingNight: string;
  /** Half-open, as UTC instants. */
  readonly start: string;
  readonly end: string;
  readonly note: string | null;
  /** The source's colour; the workbook has none. */
  readonly background: string;
  /** Absent means SCIENCE: the published sheets record nothing else. */
  readonly usage?: ImportedUsage;
}

/** The workbook closes no port on its own; `port` is here for the API's shape. */
export interface ImportedClosure {
  readonly site: ImportSite;
  /** Open nights are records too, not gaps. */
  readonly availability: 'OPEN' | 'CLOSED';
  readonly port: number | null;
  readonly firstSheetDate: string;
  readonly lastSheetDate: string;
  readonly firstObservingNight: string;
  readonly lastObservingNight: string;
  readonly start: string;
  readonly end: string;
  readonly reason: string | null;
}

/** A gap still means "not recorded"; `NONE` is a recorded fact. */
export interface ImportedTooSupport {
  readonly site: ImportSite;
  readonly start: string;
  readonly end: string;
  readonly tooSupport: TooSupportLevel;
  readonly note: string | null;
}

export interface ImportedSubsystem {
  readonly site: ImportSite;
  readonly subsystem: SubsystemName;
  readonly usage: ImportedUsage;
  readonly start: string;
  readonly end: string;
  readonly note: string | null;
}

export interface ImportedTelescopeMode {
  readonly site: ImportSite;
  readonly start: string;
  readonly end: string;
  readonly mode: TelescopeModeType;
  /** Named only on a CLASSICAL or PRIORITY_VISITOR span. */
  readonly programReferences: readonly string[];
  /** BLOCK_SCHEDULING only; the workbook records none. */
  readonly partner: PartnerTag | null;
  readonly note: string | null;
}

/** The workbook prints no legend. */
export interface LegendEntry {
  readonly label: string;
  readonly background: string;
}

/** The workbook prints none; the calendar computes its own moon. */
export interface PublishedMoonEvent {
  readonly date: string;
  readonly phase: 'NEW' | 'FULL';
}

export interface ImportedSchedule {
  readonly site: ImportSite;
  readonly semester: string;
  readonly title: string;
  readonly version: string | null;
  /** Set only on a hand-written schedule, so a consumer can keep invented records apart from real ones. */
  readonly demo?: true;
  readonly nightLabelling: NightLabelling;
  readonly legend: readonly LegendEntry[];
  readonly blocks: readonly ImportedBlock[];
  readonly closures: readonly ImportedClosure[];
  readonly tooSupport?: readonly ImportedTooSupport[];
  readonly modes?: readonly ImportedTelescopeMode[];
  readonly subsystems?: readonly ImportedSubsystem[];
  /** The workbook carries neither, so both are empty. */
  readonly holidays: readonly string[];
  readonly moonEvents: readonly PublishedMoonEvent[];
  readonly warnings: readonly string[];
}
