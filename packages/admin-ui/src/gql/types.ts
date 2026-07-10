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
