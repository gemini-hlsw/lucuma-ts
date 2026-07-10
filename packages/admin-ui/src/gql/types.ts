/*
 * View-model types for the Admin views: the shapes the tables and editors
 * render, produced by each view's mapper (cfp.ts, programs.ts, …) from the
 * codegen-typed ODB responses. Wire types come from codegen (src/gql/gen);
 * these stay hand-modeled because they are UI domain shapes, not the schema.
 */
import type { Partner } from '@/auth/ssoGraphql';

// --- Calls for Proposals view (ODB CallForProposals) ---------------------

/** The schema's GeminiCallForProposalsType enum → display label. */
export const CFP_TYPE_LABEL = {
  REGULAR_SEMESTER: 'Regular Semester',
  FAST_TURNAROUND: 'Fast Turnaround',
  LARGE_PROGRAM: 'Large Program',
  DIRECTORS_TIME: "Director's Time",
  POOR_WEATHER: 'Poor Weather',
  DEMO_SCIENCE: 'Demo Science',
  SYSTEM_VERIFICATION: 'System Verification',
} as const;

export type CfpType = keyof typeof CFP_TYPE_LABEL;

/** RA/Dec window for one Gemini site. */
export interface SiteCoordinateLimits {
  readonly raStart: number; // hours, 0–24
  readonly raEnd: number;
  readonly decStart: number; // degrees, −90–90
  readonly decEnd: number;
}

/** A partner's participation in a call, with an optional deadline override. */
export interface CfpPartner {
  readonly partner: Partner;
  readonly deadlineOverride?: string; // ISO date; falls back to the CfP default
}

export interface CallForProposals {
  readonly id: string;
  readonly title: string;
  readonly type: CfpType;
  readonly semester: string; // e.g. "2027B"
  readonly activeStart: string; // ISO date
  readonly activeEnd: string;
  readonly active: boolean;
  readonly allowsNonPartnerPi: boolean;
  readonly proprietaryMonths: number;
  readonly defaultDeadline: string; // ISO date
  readonly north: SiteCoordinateLimits;
  readonly south: SiteCoordinateLimits;
  readonly instruments: readonly string[];
  readonly partners: readonly CfpPartner[];
}

/** ODB `Instrument` enum → display label. Keys are the complete enum; models
 *  carry enum values and only the UI renders labels, so membership checks
 *  never depend on display formatting. */
export const INSTRUMENT_LABEL = {
  ACQ_CAM_NORTH: 'Acq Cam North',
  ACQ_CAM_SOUTH: 'Acq Cam South',
  ALOPEKE: 'Alopeke',
  FLAMINGOS2: 'Flamingos-2',
  GHOST: 'GHOST',
  GMOS_NORTH: 'GMOS-N',
  GMOS_SOUTH: 'GMOS-S',
  GNIRS: 'GNIRS',
  GPI: 'GPI',
  GSAOI: 'GSAOI',
  IGRINS2: 'IGRINS-2',
  MAROON_X: 'MAROON-X',
  NIRI: 'NIRI',
  SCORPIO: 'SCORPIO',
  VISITOR_NORTH: 'Visitor North',
  VISITOR_SOUTH: 'Visitor South',
  ZORRO: 'Zorro',
} as const;

export type Instrument = keyof typeof INSTRUMENT_LABEL;

/** Instruments offerable on a call, in checklist (label) order. */
export const INSTRUMENTS = (Object.keys(INSTRUMENT_LABEL) as readonly Instrument[])
  .slice()
  .sort((a, b) => INSTRUMENT_LABEL[a].localeCompare(INSTRUMENT_LABEL[b]));

// --- Programs view (ODB Program) ------------------------------------------

export type ProgramClass = 'QUEUE' | 'CLASSICAL';
export const PROGRAM_CLASSES: readonly ProgramClass[] = ['QUEUE', 'CLASSICAL'];
export const PROGRAM_CLASS_LABEL: Record<ProgramClass, string> = { QUEUE: 'Queue', CLASSICAL: 'Classical' };

export type ScienceBand = 'BAND1' | 'BAND2' | 'BAND3' | 'BAND4';
export const BANDS: readonly ScienceBand[] = ['BAND1', 'BAND2', 'BAND3', 'BAND4'];
export const BAND_LABEL: Record<ScienceBand, string> = {
  BAND1: 'Band-1',
  BAND2: 'Band-2',
  BAND3: 'Band-3',
  BAND4: 'Band-4',
};

/** One cell of the time-awards grid: hours allocated to a partner in a band. */
export interface Allocation {
  readonly category: Partner;
  readonly scienceBand: ScienceBand;
  readonly hours: number;
}

export type TooStatus = 'NONE' | 'STANDARD' | 'RAPID';
export const TOO_STATUSES: readonly TooStatus[] = ['NONE', 'STANDARD', 'RAPID'];
export const TOO_LABEL: Record<TooStatus, string> = { NONE: 'None', STANDARD: 'Standard', RAPID: 'Rapid' };

/** A contact scientist: an SSO/ODB user holding a SUPPORT_* ProgramUser role.
 *  `programUserId` is set for contacts already on the program (used to remove
 *  them); `userId` for roster picks not yet linked (used to add them). */
export interface ContactScientist {
  readonly name: string;
  readonly userId?: string;
  readonly programUserId?: string;
}

export interface Program {
  readonly id: string; // internal ProgramId, e.g. "p-172"
  /** Program reference label ("G-2027B-1234-Q"); falls back to the id. */
  readonly reference: string;
  readonly name: string;
  readonly pi: string;
  /** Derived from the proposal type's GraphQL __typename (Queue vs Classical) —
   *  there is no separate "programClass" field in the ODB schema. Other
   *  proposal types (LargeProgram, FastTurnaround, …) aren't Queue/Classical;
   *  default them to QUEUE since the Admin form only offers those two. */
  readonly programClass: ProgramClass;
  /** Only Queue proposals carry ToOActivation; Classical/others have none. */
  readonly tooStatus: TooStatus;
  /** Program users with role SUPPORT_PRIMARY/SUPPORT_SECONDARY — the real
   *  Gemini "contact scientist" roles. */
  readonly contactScientists: readonly ContactScientist[];
  /** Active date range (ISO). Every program has a start/end (the ODB's
   *  1901/2099 sentinels are shown blank), always editable as dates. */
  readonly activeStart: string;
  readonly activeEnd: string;
  readonly proprietaryMonths: number;
  /** Queue proposals only — ConsiderForBand3 is CONSIDER/DO_NOT_CONSIDER/UNSET
   *  in the ODB. True = CONSIDER, false = DO_NOT_CONSIDER or UNSET. */
  readonly considerForBand3: boolean;
  /** Queue/Classical minPercentTime — the minimum fraction of the award that
   *  must be observed for the program to count as successful. */
  readonly minPercentTime: number;
  readonly privateHeader: boolean;
  /** Names of program users (typically COIs) whose `thesis` flag is set — the
   *  ODB tracks thesis per investigator (ProgramUser.thesis), not per program. */
  readonly thesisInvestigators: readonly string[];
  readonly allocations: readonly Allocation[];
  /** The program's private note (Program.notes, isPrivate = true) — also
   *  visible to staff in Explore. `privateNoteId` is null when no private
   *  note exists yet (create vs update on save). */
  readonly privateNote: string;
  readonly privateNoteId: string | null;
}
