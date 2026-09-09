/*
 * Observation Conflict Check (sc-9243): before approving a new target, check
 * that no other active program is planning an equivalent observation.
 *
 * Two candidate pools, per the story:
 *   1. configurationRequests in programs whose active period hasn't ended;
 *   2. observations in active Target-of-Opportunity programs (ToO
 *      configurations carry no coordinates, so their observations' base
 *      coordinates are checked instead).
 *
 * The ODB filters by active end date and observing-mode type server-side; the
 * coordinate cone (sc-9240) can't be expressed yet, so separation is computed
 * here from coordinates in degrees. Once sc-9240 lands, that last filter
 * moves into the WHERE clause.
 */
import { skipToken, useQuery } from '@apollo/client/react';
import { parseNumber } from '@gemini-hlsw/lucuma-common-ui';
import { dateToLocalObservingNight } from '@gemini-hlsw/lucuma-core';
import { useMemo } from 'react';

import { searchRadiusArcsec, separationArcsec } from '@/lib/geminiArchive';

import type { DocumentType } from './gen';
import { graphql } from './gen';
import type { ConfigurationRequestStatus, ObservingModeType } from './gen/graphql';
import { asObservingModeType, DEC_DECIMALS, joinTargetNames, RA_DECIMALS, trimSexagesimal } from './shared';

/** sc-9243's "similar" observing modes: the same configuration style on the
 *  paired instrument yields equivalent data (GMOS-N ~ GMOS-S, GNIRS ~
 *  Flamingos-2, Alopeke ~ Zorro, GHOST ~ MAROON-X). The complete enum
 *  (enforced by the Record) so a new mode is a compile error, not a silent
 *  gap; a mode with no similar partner maps to just itself. */
const SIMILAR_MODE_TYPES: Record<ObservingModeType, readonly ObservingModeType[]> = {
  ALOPEKE_SPECKLE: ['ALOPEKE_SPECKLE', 'ZORRO_SPECKLE'],
  ALOPEKE_WIDE_FIELD: ['ALOPEKE_WIDE_FIELD', 'ZORRO_WIDE_FIELD'],
  EXCHANGE_KECK: ['EXCHANGE_KECK'],
  EXCHANGE_SUBARU: ['EXCHANGE_SUBARU'],
  FLAMINGOS_2_IMAGING: ['FLAMINGOS_2_IMAGING'],
  FLAMINGOS_2_LONG_SLIT: ['FLAMINGOS_2_LONG_SLIT', 'GNIRS_LONG_SLIT'],
  FLAMINGOS_2_MOS: ['FLAMINGOS_2_MOS'],
  GHOST_IFU: ['GHOST_IFU', 'MAROON_X'],
  GMOS_NORTH_IFU: ['GMOS_NORTH_IFU', 'GMOS_SOUTH_IFU'],
  GMOS_NORTH_IMAGING: ['GMOS_NORTH_IMAGING', 'GMOS_SOUTH_IMAGING'],
  GMOS_NORTH_LONG_SLIT: ['GMOS_NORTH_LONG_SLIT', 'GMOS_SOUTH_LONG_SLIT'],
  GMOS_NORTH_MOS: ['GMOS_NORTH_MOS', 'GMOS_SOUTH_MOS'],
  GMOS_SOUTH_IFU: ['GMOS_SOUTH_IFU', 'GMOS_NORTH_IFU'],
  GMOS_SOUTH_IMAGING: ['GMOS_SOUTH_IMAGING', 'GMOS_NORTH_IMAGING'],
  GMOS_SOUTH_LONG_SLIT: ['GMOS_SOUTH_LONG_SLIT', 'GMOS_NORTH_LONG_SLIT'],
  GMOS_SOUTH_MOS: ['GMOS_SOUTH_MOS', 'GMOS_NORTH_MOS'],
  GNIRS_IFU: ['GNIRS_IFU'],
  GNIRS_IMAGING: ['GNIRS_IMAGING'],
  GNIRS_LONG_SLIT: ['GNIRS_LONG_SLIT', 'FLAMINGOS_2_LONG_SLIT'],
  IGRINS_2_LONG_SLIT: ['IGRINS_2_LONG_SLIT'],
  MAROON_X: ['MAROON_X', 'GHOST_IFU'],
  VISITOR_NORTH: ['VISITOR_NORTH'],
  VISITOR_SOUTH: ['VISITOR_SOUTH'],
  ZORRO_SPECKLE: ['ZORRO_SPECKLE', 'ALOPEKE_SPECKLE'],
  ZORRO_WIDE_FIELD: ['ZORRO_WIDE_FIELD', 'ALOPEKE_WIDE_FIELD'],
};

export function similarModeTypes(modeType: string | null): readonly ObservingModeType[] {
  const mode = asObservingModeType(modeType);
  return mode ? SIMILAR_MODE_TYPES[mode] : [];
}

/**
 * Both candidate pools in one round-trip. `$modeTypes` is the union of the
 * similar-mode groups of the items under review; `$today` (yyyy-mm-dd) scopes
 * both pools to programs still active. WhereConfigurationRequest has no
 * observing-mode filter, so pool 1 is narrowed client-side in matchConflicts.
 */
export const CONFLICTS_QUERY = graphql(`
  query AdminConflictCheck($modeTypes: [ObservingModeType!]!, $today: Date!) {
    configurationRequests(WHERE: { program: { activeEnd: { GT: $today } } }, LIMIT: 1000) {
      matches {
        id
        status
        # Resolve the request's target name(s) from its observations (sc-10159
        # items 4-5) — a Configuration carries coordinates, not a name.
        applicableObservations
        program {
          id
          reference {
            label
          }
        }
        configuration {
          target {
            coordinates {
              ra {
                hms
                degrees
              }
              dec {
                dms
                degrees
              }
            }
          }
          observingMode {
            mode
          }
        }
      }
    }
    observations(
      WHERE: {
        program: { activeEnd: { GT: $today } }
        observingModeType: { IN: $modeTypes }
        # Science observations only — calibrations aren't conflicts (sc-9591).
        calibrationRole: { IS_NULL: true }
      }
      LIMIT: 1000
    ) {
      matches {
        id
        reference {
          label
        }
        workflow {
          value {
            state
          }
        }
        observingMode {
          mode
        }
        program {
          id
          reference {
            label
          }
          proposal {
            gemini {
              ... on Queue {
                tooActivationCeiling
              }
              ... on LargeProgram {
                tooActivationCeiling
              }
              ... on DirectorsTime {
                tooActivationCeiling
              }
              ... on FastTurnaround {
                tooActivationCeiling
              }
            }
          }
        }
        targetEnvironment {
          firstScienceTarget {
            id
            name
            sidereal {
              ra {
                hms
                degrees
              }
              dec {
                dms
                degrees
              }
            }
          }
        }
      }
    }
  }
`);

export type AdminConflictCheckResult = DocumentType<typeof CONFLICTS_QUERY>;

/**
 * Fetch both sc-9243 candidate pools for the union of the sources' similar
 * observing modes, live from the ODB (check-time data — never cached). The
 * query re-runs whenever the union of modes changes; the per-source cone
 * match happens afterwards in matchConflicts.
 */
export function useConflictCandidates(sources: readonly { readonly modeType: string | null }[]) {
  // Not memoized: callers build `sources` inline, so any memo keyed on it would
  // miss every render anyway, and Apollo compares watch options — variables
  // included — structurally (@wry/equality), so an equal array built afresh does
  // not refetch. Deduping a handful of modes each render is cheaper than the
  // machinery needed to avoid it.
  const modeTypes = Array.from(new Set(sources.flatMap((s) => similarModeTypes(s.modeType)))).sort();
  const { data, loading, error } = useQuery(
    CONFLICTS_QUERY,
    modeTypes.length === 0
      ? skipToken
      : {
          variables: { modeTypes: [...modeTypes], today: dateToLocalObservingNight(new Date()) },
          fetchPolicy: 'network-only',
        },
  );
  const candidates = useMemo(() => (data ? mapConflictCandidates(data) : []), [data]);
  return { candidates, loading, error };
}

/** One planned observation elsewhere that could yield equivalent data. */
export interface ConflictCandidate {
  /** The program's reference label ("G-2027B-1235-Q"), linkable to Explore
   *  (sc-10159 items 1-2). Null only when the program has no reference. */
  readonly programLabel: string | null;
  /** The trailing identifier shown after the program label: the request id
   *  for a configuration request, or the ToO observation's reference/id. */
  readonly detailLabel: string;
  readonly programId: string;
  /** Excluded from matching against itself when the source is a request. */
  readonly requestId: string | null;
  /** CR status (Requested/Approved/Denied) or observation workflow state. */
  readonly status: string;
  /** Target name where directly known (ToO observations). CR configurations
   *  carry no name — resolved from `applicableObservations` for display rows. */
  readonly target: string;
  /** The request's applicable observation ids, used to look up target names
   *  (sc-10159 items 4-5). Empty for ToO-observation candidates. */
  readonly applicableObservations: readonly string[];
  /** Sexagesimal RA/Dec for display (sc-10159 item 7); "—" when unknown. */
  readonly ra: string;
  readonly dec: string;
  readonly raDeg: number | null;
  readonly decDeg: number | null;
  readonly modeType: string | null;
}

// WITHDRAWN requests are dead plans — not conflicts — so they never label.
const CR_STATUS_LABEL: Partial<Record<ConfigurationRequestStatus, string>> = {
  REQUESTED: 'Requested',
  APPROVED: 'Approved',
  DENIED: 'Denied',
};

/** Every candidate from both pools. The ToO restriction of pool 2 is applied
 *  here (the ODB can't filter on toOActivation); the coordinate cone is
 *  applied later, per source, in matchConflicts. */
export function mapConflictCandidates(raw: AdminConflictCheckResult): ConflictCandidate[] {
  const fromRequests = raw.configurationRequests.matches.map((c): ConflictCandidate => {
    const coords = c.configuration.target?.coordinates;
    return {
      programLabel: c.program.reference?.label ?? null,
      detailLabel: c.id,
      programId: c.program.id,
      requestId: c.id,
      status: CR_STATUS_LABEL[c.status] ?? c.status,
      target: '—', // resolved from applicableObservations by the display layer
      applicableObservations: c.applicableObservations,
      ra: coords ? trimSexagesimal(coords.ra.hms, RA_DECIMALS) : '—',
      dec: coords ? trimSexagesimal(coords.dec.dms, DEC_DECIMALS) : '—',
      raDeg: parseNumber(coords?.ra.degrees) ?? null,
      decDeg: parseNumber(coords?.dec.degrees) ?? null,
      modeType: c.configuration.observingMode?.mode ?? null,
    };
  });
  const fromToO = raw.observations.matches
    .filter((o) => {
      const gemini = o.program.proposal?.gemini;
      const ceiling = gemini && 'tooActivationCeiling' in gemini ? gemini.tooActivationCeiling : undefined;
      // The ceiling is the most disruptive activation the program's
      // observations may declare, so any value above NONE marks a ToO program.
      // Excluding NONE keeps new levels (INTERRUPTING) in scope automatically.
      return ceiling !== undefined && ceiling !== 'NONE';
    })
    .map((o): ConflictCandidate => {
      const target = o.targetEnvironment.firstScienceTarget;
      const state = o.workflow?.value?.state ?? 'UNDEFINED';
      const sidereal = target?.sidereal;
      const programLabel = o.program.reference?.label ?? null;
      const obsRef = o.reference?.label ?? o.id;
      return {
        programLabel,
        // An observation reference embeds its program reference
        // ("G-2027B-0057-Q-0311"); drop that prefix, and the hyphen joining it,
        // so the linked program label isn't shown twice. Falls back to the full
        // reference/id when it doesn't carry the prefix.
        // `|| obsRef` keeps a malformed reference ("…-Q-") from stripping to
        // nothing, which would render a bare link and weaken the row key.
        detailLabel:
          (programLabel !== null && obsRef.startsWith(`${programLabel}-`)
            ? obsRef.slice(programLabel.length + 1)
            : obsRef) || obsRef,
        programId: o.program.id,
        requestId: null,
        status: state.charAt(0) + state.slice(1).toLowerCase(),
        target: target?.name ?? '—',
        applicableObservations: [],
        ra: sidereal ? trimSexagesimal(sidereal.ra.hms, RA_DECIMALS) : '—',
        dec: sidereal ? trimSexagesimal(sidereal.dec.dms, DEC_DECIMALS) : '—',
        raDeg: parseNumber(sidereal?.ra.degrees) ?? null,
        decDeg: parseNumber(sidereal?.dec.degrees) ?? null,
        modeType: o.observingMode?.mode ?? null,
      };
    });
  return [...fromRequests, ...fromToO];
}

/** A request/observation under review, checked against the candidate pools. */
export interface ConflictSource {
  readonly id: string;
  /** The source's own program — its candidates aren't conflicts. */
  readonly programId: string;
  readonly raDeg: number | null;
  readonly decDeg: number | null;
  readonly modeType: string | null;
}

/** One row of the "Potential Conflicts" table. */
export interface ConflictRow extends ConflictCandidate {
  /** Row identity for the table: one candidate can conflict with several
   *  selected sources, so the candidate label alone is not unique. */
  readonly key: string;
  readonly sourceId: string;
  readonly sepArcsec: number;
}

/** Apply the sc-9243 match rule per source: a similar observing mode within
 *  DISTANCE (half the source configuration's largest field-of-view dimension)
 *  of the source coordinates, in a different program. */
export function matchConflicts(
  sources: readonly ConflictSource[],
  candidates: readonly ConflictCandidate[],
): ConflictRow[] {
  const rows: ConflictRow[] = [];
  for (const s of sources) {
    if (s.raDeg === null || s.decDeg === null) continue;
    const similar = new Set<string>(similarModeTypes(s.modeType));
    const radius = searchRadiusArcsec(s.modeType);
    for (const c of candidates) {
      if (c.programId === s.programId || c.requestId === s.id) continue;
      if (c.raDeg === null || c.decDeg === null || c.modeType === null || !similar.has(c.modeType)) continue;
      const sep = separationArcsec(s.raDeg, s.decDeg, c.raDeg, c.decDeg);
      if (sep <= radius)
        rows.push({ ...c, key: `${s.id}:${c.programId}:${c.detailLabel}`, sourceId: s.id, sepArcsec: sep });
    }
  }
  return rows.sort((a, b) => a.sourceId.localeCompare(b.sourceId) || a.sepArcsec - b.sepArcsec);
}

/*
 * A configuration request carries no target name, only coordinates — the name
 * lives on its applicable observations (sc-10159 items 4-5). We resolve names
 * only for the requests that actually surface as conflict rows (never the full
 * 1000-candidate pool), in one id-batched query. `id: { IN: [...] }` is bounded
 * by the number of displayed rows, so it can't approach Postgres's bind-param
 * limit the way a program-wide fetch could.
 */
export const CONFLICT_TARGETS_QUERY = graphql(`
  query AdminConflictTargets($ids: [ObservationId!]!) {
    observations(WHERE: { id: { IN: $ids } }, LIMIT: 1000) {
      matches {
        id
        targetEnvironment {
          firstScienceTarget {
            id
            name
          }
        }
      }
    }
  }
`);

export type AdminConflictTargetsResult = DocumentType<typeof CONFLICT_TARGETS_QUERY>;

/** Resolve display target names for the change-request conflict rows: an id →
 *  name map over the union of their applicable observations (sc-10159). ToO
 *  rows already carry a name and contribute no ids, so the query is skipped
 *  entirely when there are none.
 *
 *  `network-only` rather than the app's usual `cache-and-network`: the conflict
 *  check is consulted to decide whether to approve a request, so it reads the
 *  ODB as it stands now — the same reason the candidate query above does. A
 *  name cached from an earlier visit would be shown without any indication it
 *  is stale. (Not reachable by a test here: every render builds a cold cache,
 *  which makes the two policies indistinguishable.) */
export function useConflictTargetNames(rows: readonly ConflictRow[]): ReadonlyMap<string, string> {
  const ids = useMemo(() => Array.from(new Set(rows.flatMap((r) => r.applicableObservations))).sort(), [rows]);
  const { data } = useQuery(
    CONFLICT_TARGETS_QUERY,
    ids.length === 0 ? skipToken : { variables: { ids: [...ids] }, fetchPolicy: 'network-only' },
  );
  return useMemo(() => {
    const byId = new Map<string, string>();
    for (const o of data?.observations.matches ?? []) {
      // The schema makes a target's name non-null, so only the target itself
      // can be absent — an observation without one simply contributes nothing.
      const name = o.targetEnvironment.firstScienceTarget?.name;
      if (name !== undefined) byId.set(o.id, name);
    }
    return byId;
  }, [data]);
}

/** The distinct target names of a conflict row: for a change request, the
 *  names of its applicable observations (from `targetsById`); for a ToO
 *  observation, its own already-known name. "—" when none resolve. */
export function conflictTargetLabel(row: ConflictRow, targetsById: ReadonlyMap<string, string>): string {
  if (row.applicableObservations.length === 0) return row.target;
  return joinTargetNames(row.applicableObservations.map((id) => targetsById.get(id)));
}
