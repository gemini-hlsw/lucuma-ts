/*
 * Observation Conflict Check (sc-9243): before a request is approved, look for
 * equivalent plans in other active programs. Two pools: configuration requests,
 * and the live observations of accepted science programs, since a ToO program's
 * requests carry no coordinates. The ODB judges proximity, one cone per source.
 */
import type { ErrorLike } from '@apollo/client';
import { skipToken, useQuery } from '@apollo/client/react';
import { parseNumber } from '@gemini-hlsw/lucuma-common-ui';
import { dateToLocalObservingNight } from '@gemini-hlsw/lucuma-core';
import { useMemo } from 'react';

import { searchRadiusArcsec, separationArcsec } from '@/lib/geminiArchive';

import type { ObservationRow } from '../types';
import { graphql } from './gen';
import type {
  AdminConflictObservationsQueryVariables,
  AdminConflictRequestsQueryVariables,
  ConfigurationRequestStatus,
  ConflictObservationCandidateFragment,
  ConflictRequestCandidateFragment,
  ObservingModeType,
  WhereCone,
  WhereConfigurationRequest,
  WhereObservation,
} from './gen/graphql';
import { asObservingModeType, basePositionOf, degreesOf, formatDec, formatRa, joinTargetNames } from './shared';

/** sc-9243's similar modes: the same configuration on the paired instrument.
 *  The Record covers the whole enum, so a new mode is a compile error. */
const SIMILAR_MODE_TYPES: Record<ObservingModeType, readonly ObservingModeType[]> = {
  ALOPEKE_SPECKLE: ['ALOPEKE_SPECKLE', 'ZORRO_SPECKLE'],
  ALOPEKE_WIDE_FIELD: ['ALOPEKE_WIDE_FIELD', 'ZORRO_WIDE_FIELD'],
  DAYTIME_CALIBRATION: ['DAYTIME_CALIBRATION'],
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
  SCORPIO_LONG_SLIT: ['SCORPIO_LONG_SLIT'],
  VISITOR_NORTH: ['VISITOR_NORTH'],
  VISITOR_SOUTH: ['VISITOR_SOUTH'],
  ZORRO_SPECKLE: ['ZORRO_SPECKLE', 'ALOPEKE_SPECKLE'],
  ZORRO_WIDE_FIELD: ['ZORRO_WIDE_FIELD', 'ALOPEKE_WIDE_FIELD'],
};

export function similarModeTypes(modeType: string | null): readonly ObservingModeType[] {
  const mode = asObservingModeType(modeType);
  return mode ? SIMILAR_MODE_TYPES[mode] : [];
}

/** One configuration request in another program, as a candidate conflict. */
export const CONFLICT_REQUEST_FRAGMENT = graphql(`
  fragment ConflictRequestCandidate on ConfigurationRequest {
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
`);

/** One observation in another program, as a candidate conflict. */
export const CONFLICT_OBSERVATION_FRAGMENT = graphql(`
  fragment ConflictObservationCandidate on Observation {
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
    }
    targetEnvironment {
      ...ConflictBase
    }
  }
`);

/* One operation per pool and source, each with the source's cone. */
export const CONFLICT_REQUESTS_QUERY = graphql(`
  query AdminConflictRequests($where: WhereConfigurationRequest!) {
    configurationRequests(WHERE: $where, LIMIT: 1000) {
      hasMore
      matches {
        ...ConflictRequestCandidate
      }
    }
  }
`);

export const CONFLICT_OBSERVATIONS_QUERY = graphql(`
  query AdminConflictObservations($where: WhereObservation!) {
    observations(WHERE: $where, LIMIT: 1000) {
      hasMore
      matches {
        ...ConflictObservationCandidate
      }
    }
  }
`);

/** A source that can describe a cone. Sources without coordinates raise none. */
export type PositionedSource = ConflictSource & { readonly raDeg: number; readonly decDeg: number };

/** The cone for one source: the story's DISTANCE rule, in one place. */
function coneFor(source: PositionedSource): WhereCone {
  return {
    center: { ra: { degrees: source.raDeg }, dec: { degrees: source.decDeg } },
    distance: { arcseconds: searchRadiusArcsec(source.modeType) },
  };
}

export function requestsVariables(source: PositionedSource, today: string): AdminConflictRequestsQueryVariables {
  const where: WhereConfigurationRequest = {
    program: { activeEnd: { GT: today }, id: { NEQ: source.programId } },
    observingModeType: { IN: [...similarModeTypes(source.modeType)] },
    // A withdrawn request is a dead plan, not a conflict.
    status: { NEQ: 'WITHDRAWN' },
    targetCoordinates: coneFor(source),
  };
  return { where };
}

export function observationsVariables(
  source: PositionedSource,
  today: string,
): AdminConflictObservationsQueryVariables {
  const where: WhereObservation = {
    // Plans of accepted science programs. A completed observation stays: the design lists Observed conflicts.
    program: {
      activeEnd: { GT: today },
      id: { NEQ: source.programId },
      proposalStatus: { EQ: 'ACCEPTED' },
      type: { EQ: 'SCIENCE' },
    },
    workflow: { workflowState: { NEQ: 'INACTIVE' } },
    observingModeType: { IN: [...similarModeTypes(source.modeType)] },
    // Science observations only: calibrations aren't conflicts (sc-9591).
    calibrationRole: { IS_NULL: true },
    targetCoordinates: coneFor(source),
  };
  return { where };
}

/** A source that can be checked: it has a position and at least one similar mode.
 *  The rest are reported as not checked, rather than as clear. */
export function isCheckable(
  source: ConflictSource | ObservationSource,
): source is PositionedSource | ObservationSource {
  const placed = 'atBase' in source || (source.raDeg !== null && source.decDeg !== null);
  return placed && similarModeTypes(source.modeType).length > 0;
}

/*
 * The base position of an asterism under review, which only the ODB can compute. One
 * observation per request: a failing base nulls `basePosition` for every row of a response.
 */
export const CONFLICT_BASE_QUERY = graphql(`
  query AdminConflictBase($id: ObservationId!) {
    observation(observationId: $id) {
      id
      targetEnvironment {
        basePosition {
          # An asterism's centre: the ODB fills coordinates, never sidereal.
          coordinates {
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
`);

/** The ODB's base position for one observation under review, live. */
export function useBasePosition(id: string) {
  const { data, loading, error } = useQuery(CONFLICT_BASE_QUERY, {
    variables: { id },
    fetchPolicy: 'network-only',
  });
  const position = useMemo(() => {
    return degreesOf(data?.observation?.targetEnvironment.basePosition?.coordinates);
  }, [data]);
  return { position, notFound: data?.observation === null, loading, error };
}

/** An observation under review as a source: at its stored base, or one the ODB must compute. */
export function observationSource(
  row: Pick<ObservationRow, 'id' | 'modeType' | 'base'>,
  programId: string,
): ConflictSource | ObservationSource {
  const { id, modeType, base } = row;
  if (base === 'lookup') return { id, programId, modeType, atBase: true };
  const at = base === 'none' ? null : base;
  return { id, programId, modeType, raDeg: at?.raDeg ?? null, decDeg: at?.decDeg ?? null };
}

/** One pool's answer for a source. */
interface Pool<T> {
  readonly page: { readonly hasMore: boolean; readonly matches: readonly T[] } | undefined;
  readonly loading: boolean;
  readonly error: ErrorLike | undefined;
}

export interface ConflictCheck {
  readonly candidates: readonly ConflictCandidate[];
  readonly loading: boolean;
  readonly error: ErrorLike | null;
  readonly truncated: boolean;
}

/** One source's check from its two pools. Nothing is listed until both have answered, and a
 *  pool that answered without a page is an error: neither may read as an all-clear. */
export function combinePools(
  requests: Pool<ConflictRequestCandidateFragment>,
  observations: Pool<ConflictObservationCandidateFragment>,
): ConflictCheck {
  const loading = requests.loading || observations.loading;
  const error = requests.error ?? observations.error ?? null;
  if (error) return { candidates: [], loading, error, truncated: false };
  if (!requests.page || !observations.page) {
    const noData = loading ? null : new Error('The ODB returned no data for a conflict query.');
    return { candidates: [], loading, error: noData, truncated: false };
  }
  return {
    candidates: withoutRequestedObservations([
      ...mapRequestCandidates(requests.page.matches),
      ...mapObservationCandidates(observations.page.matches),
    ]),
    loading,
    error: null,
    truncated: requests.page.hasMore || observations.page.hasMore,
  };
}

/** Both candidate pools for one source. `network-only`: an approval is decided on the ODB as it stands now. */
export function useConflictCandidates(source: PositionedSource): ConflictCheck {
  // Read on each render, so a page left open past the observing-night boundary refetches on its next one.
  const today = dateToLocalObservingNight(new Date());
  const requests = useQuery(CONFLICT_REQUESTS_QUERY, {
    variables: requestsVariables(source, today),
    fetchPolicy: 'network-only',
  });
  const observations = useQuery(CONFLICT_OBSERVATIONS_QUERY, {
    variables: observationsVariables(source, today),
    fetchPolicy: 'network-only',
  });
  return useMemo(
    () =>
      combinePools(
        { page: requests.data?.configurationRequests, loading: requests.loading, error: requests.error },
        { page: observations.data?.observations, loading: observations.loading, error: observations.error },
      ),
    [requests.data, requests.loading, requests.error, observations.data, observations.loading, observations.error],
  );
}

/** One planned observation elsewhere that could yield equivalent data. */
export interface ConflictCandidate {
  /** The program's reference label ("G-2027B-1235-Q"), linkable to Explore
   *  (sc-10159 items 1-2). Null only when the program has no reference. */
  readonly programLabel: string | null;
  /** The trailing identifier shown after the program label: the request id
   *  for a configuration request, or the observation's reference/id. */
  readonly detailLabel: string;
  /** The candidate observation's own id; null for a configuration request. */
  readonly observationId: string | null;
  readonly programId: string;
  /** CR status (Requested/Approved/Denied) or observation workflow state. */
  readonly status: string;
  /** Target name where directly known (observation candidates). CR configurations
   *  carry no name — resolved from `applicableObservations` for display rows. */
  readonly target: string;
  /** The request's applicable observation ids, used to look up target names
   *  (sc-10159 items 4-5). Empty for observation candidates. */
  readonly applicableObservations: readonly string[];
  /** Sexagesimal RA/Dec for display (sc-10159 item 7); "—" when unknown. */
  readonly ra: string;
  readonly dec: string;
  readonly raDeg: number | null;
  readonly decDeg: number | null;
  readonly modeType: string | null;
}

/** Withdrawn requests are excluded in the query, so only these three arrive. */
const CR_STATUS_LABEL: Partial<Record<ConfigurationRequestStatus, string>> = {
  REQUESTED: 'Requested',
  APPROVED: 'Approved',
  DENIED: 'Denied',
};

/** The candidates in one pool's result. The ODB has applied the cone, mode and program filters. */
export function mapRequestCandidates(matches: readonly ConflictRequestCandidateFragment[]): ConflictCandidate[] {
  return matches.map((c): ConflictCandidate => {
    const coords = c.configuration.target?.coordinates;
    const raDeg = parseNumber(coords?.ra.degrees) ?? null;
    const decDeg = parseNumber(coords?.dec.degrees) ?? null;
    return {
      programLabel: c.program.reference?.label ?? null,
      detailLabel: c.id,
      observationId: null,
      programId: c.program.id,
      status: CR_STATUS_LABEL[c.status] ?? c.status,
      target: '—', // resolved from applicableObservations by the display layer
      applicableObservations: c.applicableObservations,
      ra: raDeg === null ? '—' : formatRa(raDeg),
      dec: decDeg === null ? '—' : formatDec(decDeg),
      raDeg,
      decDeg,
      modeType: c.configuration.observingMode?.mode ?? null,
    };
  });
}

export function mapObservationCandidates(
  matches: readonly ConflictObservationCandidateFragment[],
): ConflictCandidate[] {
  return matches.map((o): ConflictCandidate => {
    // An asterism's centre is not fetched for candidates: the ODB's cone already matched it.
    const base = basePositionOf(o.targetEnvironment);
    const raDeg = typeof base === 'object' ? base.raDeg : null;
    const decDeg = typeof base === 'object' ? base.decDeg : null;
    const state = o.workflow?.value?.state ?? 'UNDEFINED';
    const programLabel = o.program.reference?.label ?? null;
    const obsRef = o.reference?.label ?? o.id;
    return {
      observationId: o.id,
      programLabel,
      // "G-2027B-0057-Q-0311" shows as "0311" beside its linked program label.
      // `|| obsRef` keeps a malformed reference ("…-Q-") from stripping to nothing.
      detailLabel:
        (programLabel !== null && obsRef.startsWith(`${programLabel}-`)
          ? obsRef.slice(programLabel.length + 1)
          : obsRef) || obsRef,
      programId: o.program.id,
      status: state.charAt(0) + state.slice(1).toLowerCase(),
      target: joinTargetNames(o.targetEnvironment.asterism.map((t) => t.name)),
      applicableObservations: [],
      ra: raDeg === null ? '—' : formatRa(raDeg),
      dec: decDeg === null ? '—' : formatDec(decDeg),
      raDeg,
      decDeg,
      modeType: o.observingMode?.mode ?? null,
    };
  });
}

/** Drop an observation already reported through a configuration request: its
 *  request is the candidate the reviewer acts on, and listing both shows one plan
 *  twice. A denied request is no plan to act on, so it does not hide its
 *  observation either. */
export function withoutRequestedObservations(candidates: readonly ConflictCandidate[]): ConflictCandidate[] {
  const requested = new Set(
    candidates.filter((c) => c.status !== CR_STATUS_LABEL.DENIED).flatMap((c) => c.applicableObservations),
  );
  return candidates.filter((c) => c.observationId === null || !requested.has(c.observationId));
}

/** A request or observation under review, checked at its position. */
export interface ConflictSource {
  readonly id: string;
  /** The source's own program — its candidates aren't conflicts. */
  readonly programId: string;
  readonly raDeg: number | null;
  readonly decDeg: number | null;
  readonly modeType: string | null;
}

/** An observation under review whose base the ODB computes (an asterism), read by id. */
export interface ObservationSource {
  readonly id: string;
  readonly programId: string;
  readonly modeType: string | null;
  readonly atBase: true;
}

/** One row of the "Potential Conflicts" table. */
export interface ConflictRow extends ConflictCandidate {
  /** Row identity for the table: the candidate's program and trailing label. */
  readonly key: string;
  /** Separation from the source, for display; null when the candidate has no position. */
  readonly sepArcsec: number | null;
}

/** The source's candidates as table rows, nearest first. Proximity is not re-tested: the ODB
 *  matched on the J2000 position, but returns the catalogue-epoch one. */
export function conflictRows(source: PositionedSource, candidates: readonly ConflictCandidate[]): ConflictRow[] {
  const rows = candidates.map((c): ConflictRow => ({
    ...c,
    key: `${c.programId}:${c.detailLabel}`,
    sepArcsec:
      c.raDeg === null || c.decDeg === null ? null : separationArcsec(source.raDeg, source.decDeg, c.raDeg, c.decDeg),
  }));
  // Ties and unknown separations fall back to program and detail label, so the order is stable.
  return rows.sort(
    (a, b) =>
      (a.sepArcsec ?? Infinity) - (b.sepArcsec ?? Infinity) ||
      (a.programLabel ?? a.programId).localeCompare(b.programLabel ?? b.programId) ||
      a.detailLabel.localeCompare(b.detailLabel),
  );
}

/* A configuration request carries no target name; it lives on its applicable observations
 * (sc-10159). Names are read only for the rows shown, in one query per section.
 * The id list is bounded by the rows shown, so it stays clear of Postgres's bind-parameter limit. */
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

/** Target names of the request rows' applicable observations, by observation id; skipped
 *  when no row has any. `network-only`, as the check reads the ODB as it stands now. */
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
 *  names of its applicable observations (from `targetsById`); for an
 *  observation candidate, its own already-known name. "—" when none resolve. */
export function conflictTargetLabel(row: ConflictRow, targetsById: ReadonlyMap<string, string>): string {
  if (row.applicableObservations.length === 0) return row.target;
  return joinTargetNames(row.applicableObservations.map((id) => targetsById.get(id)));
}
