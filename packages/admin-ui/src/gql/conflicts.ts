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
import { useMemo } from 'react';

import { searchRadiusArcsec, separationArcsec } from '@/lib/geminiArchive';

import type { DocumentType } from './odb/gen';
import { graphql } from './odb/gen';
import type { ConfigurationRequestStatus, ObservingModeType } from './odb/gen/graphql';

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
  GHOST_IFU: ['GHOST_IFU', 'MAROON_X'],
  GMOS_NORTH_IMAGING: ['GMOS_NORTH_IMAGING', 'GMOS_SOUTH_IMAGING'],
  GMOS_NORTH_LONG_SLIT: ['GMOS_NORTH_LONG_SLIT', 'GMOS_SOUTH_LONG_SLIT'],
  GMOS_SOUTH_IMAGING: ['GMOS_SOUTH_IMAGING', 'GMOS_NORTH_IMAGING'],
  GMOS_SOUTH_LONG_SLIT: ['GMOS_SOUTH_LONG_SLIT', 'GMOS_NORTH_LONG_SLIT'],
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

/** Widen a wire value (the fragment types carry `string` for observingMode
 *  .mode) into the enum, or null when it isn't one. */
export function asObservingModeType(modeType: string | null): ObservingModeType | null {
  return modeType !== null && modeType in SIMILAR_MODE_TYPES ? (modeType as ObservingModeType) : null;
}

export function similarModeTypes(modeType: string | null): readonly ObservingModeType[] {
  const mode = asObservingModeType(modeType);
  return mode ? SIMILAR_MODE_TYPES[mode] : [];
}

/** ObservingModeType → the short Config label used in the conflicts table
 *  ("GMOS_SOUTH_LONG_SLIT" → "GMOS-S LongSlit"). */
export function formatModeType(modeType: string | null): string {
  if (!modeType) return '—';
  const [, instrument, suffix] =
    /^(GMOS_NORTH|GMOS_SOUTH|FLAMINGOS_2|GNIRS|IGRINS_2|ALOPEKE|ZORRO|GHOST|MAROON_X|VISITOR)_?(.*)$/.exec(modeType) ??
    [];
  if (!instrument) return modeType;
  const label = instrument.replace('_NORTH', '-N').replace('_SOUTH', '-S').replace('_2', '-2').replace('_X', '-X');
  const mode = (suffix ?? '')
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');
  return mode ? `${label} ${mode}` : label;
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
                degrees
              }
              dec {
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
      WHERE: { program: { activeEnd: { GT: $today } }, observingModeType: { IN: $modeTypes } }
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
          proposal {
            gemini {
              ... on Queue {
                toOActivation
              }
              ... on LargeProgram {
                toOActivation
              }
              ... on DirectorsTime {
                toOActivation
              }
              ... on FastTurnaround {
                toOActivation
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
                degrees
              }
              dec {
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
  const modeTypes = useMemo(
    () => Array.from(new Set(sources.flatMap((s) => similarModeTypes(s.modeType)))).sort(),
    [sources],
  );
  const { data, loading, error } = useQuery(
    CONFLICTS_QUERY,
    modeTypes.length === 0
      ? skipToken
      : {
          variables: { modeTypes: [...modeTypes], today: new Date().toISOString().slice(0, 10) },
          fetchPolicy: 'network-only',
        },
  );
  const candidates = useMemo(() => (data ? mapConflictCandidates(data) : []), [data]);
  return { candidates, loading, error };
}

/** One planned observation elsewhere that could yield equivalent data. */
export interface ConflictCandidate {
  /** "G-2027B-1235-Q x-42" for a configuration request, or the observation
   *  reference label for a ToO program's observation. */
  readonly label: string;
  readonly programId: string;
  /** Excluded from matching against itself when the source is a request. */
  readonly requestId: string | null;
  /** CR status (Requested/Approved/Denied) or observation workflow state. */
  readonly status: string;
  readonly target: string;
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
      label: `${c.program.reference?.label ?? c.program.id} ${c.id}`,
      programId: c.program.id,
      requestId: c.id,
      status: CR_STATUS_LABEL[c.status] ?? c.status,
      target: '—', // configurations carry coordinates, not target names
      raDeg: coords ? Number(coords.ra.degrees) : null,
      decDeg: coords ? Number(coords.dec.degrees) : null,
      modeType: c.configuration.observingMode?.mode ?? null,
    };
  });
  const fromToO = raw.observations.matches
    .filter((o) => {
      const gemini = o.program.proposal?.gemini;
      const activation = gemini && 'toOActivation' in gemini ? gemini.toOActivation : undefined;
      return activation === 'STANDARD' || activation === 'RAPID';
    })
    .map((o): ConflictCandidate => {
      const target = o.targetEnvironment.firstScienceTarget;
      const state = o.workflow?.value?.state ?? 'UNDEFINED';
      return {
        label: o.reference?.label ?? o.id,
        programId: o.program.id,
        requestId: null,
        status: state.charAt(0) + state.slice(1).toLowerCase(),
        target: target?.name ?? '—',
        raDeg: target?.sidereal ? Number(target.sidereal.ra.degrees) : null,
        decDeg: target?.sidereal ? Number(target.sidereal.dec.degrees) : null,
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
      if (sep <= radius) rows.push({ ...c, key: `${s.id}:${c.label}`, sourceId: s.id, sepArcsec: sep });
    }
  }
  return rows.sort((a, b) => a.sourceId.localeCompare(b.sourceId) || a.sepArcsec - b.sepArcsec);
}
