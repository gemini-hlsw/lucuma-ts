/*
 * Observation Conflict Check (sc-9243): before a request is approved, look for
 * equivalent plans in other active programs. Two pools: configuration requests,
 * and the observations of every active program, since a ToO program's requests
 * carry no coordinates and a query cannot select ToO programs (WhereProgram has
 * no such filter). The ODB judges proximity, one cone per source, so no distance is
 * re-tested here. A ToO still awaiting its alert has no position and is not seen.
 */
import { skipToken, useQuery } from '@apollo/client/react';
import { parseNumber } from '@gemini-hlsw/lucuma-common-ui';
import { dateToLocalObservingNight } from '@gemini-hlsw/lucuma-core';
import { useMemo } from 'react';

import { searchRadiusArcsec, separationArcsec } from '@/lib/geminiArchive';

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
import { asObservingModeType, formatDec, formatRa, joinTargetNames } from './shared';

/** sc-9243's "similar" observing modes: the same configuration style on the
 *  paired instrument yields equivalent data (GMOS-N ~ GMOS-S, GNIRS ~
 *  Flamingos-2, Alopeke ~ Zorro, GHOST ~ MAROON-X). The complete enum
 *  (enforced by the Record) so a new mode is a compile error, not a silent
 *  gap; a mode with no similar partner maps to just itself. */
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
      # The position the telescope would slew to, which is what the story means
      # by the base coordinate. Unlike firstScienceTarget, it also covers an
      # explicit base and an asterism.
      basePosition {
        name
        # At most one of these is set: a single sidereal target fills sidereal,
        # an asterism composite or an explicit base fills coordinates.
        sidereal {
          ra {
            degrees
          }
          dec {
            degrees
          }
        }
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
`);

/*
 * Each source is two operations, one per pool (configuration requests, observations), each with
 * the source's cone, so rows stay attributed to the source whose cone found them. A cone is
 * required, not an optimisation: an observation with no targets fails the whole query
 * ("No targets are defined for o-190") when its base position is read, and a cone over
 * the whole sky fails past 10,000 matches. The WHERE filters are built in TypeScript
 * (requestsVariables, observationsVariables).
 */
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
    program: { activeEnd: { GT: today }, id: { NEQ: source.programId } },
    observingModeType: { IN: [...similarModeTypes(source.modeType)] },
    // Science observations only: calibrations aren't conflicts (sc-9591).
    calibrationRole: { IS_NULL: true },
    targetCoordinates: coneFor(source),
  };
  return { where };
}

/** A source that can be checked: it has a position and at least one similar mode.
 *  The rest are reported as not checked, rather than as clear. */
export function isCheckable(source: ConflictSource): source is PositionedSource {
  return source.raDeg !== null && source.decDeg !== null && similarModeTypes(source.modeType).length > 0;
}

/**
 * Fetch both candidate pools for one source, live from the ODB (check-time data, never served
 * from the cache). A failed or incomplete pool is reported, never read as an all-clear: a
 * source whose operation failed, or came back without data, has no candidates and an error.
 */
export function useConflictCandidates(source: PositionedSource) {
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
  const loading = requests.loading || observations.loading;

  return useMemo(() => {
    const requestPage = requests.data?.configurationRequests;
    const observationPage = observations.data?.observations;
    const error = requests.error ?? observations.error ?? null;
    if (error) return { candidates: [], loading, error, truncated: false };
    // Nothing is listed until both pools have answered: a half-answered check must not read as the whole.
    if (!requestPage || !observationPage) {
      const noData = loading ? null : new Error('The ODB returned no data for a conflict query.');
      return { candidates: [], loading, error: noData, truncated: false };
    }
    return {
      candidates: withoutRequestedObservations([
        ...mapRequestCandidates(requestPage.matches),
        ...mapObservationCandidates(observationPage.matches),
      ]),
      loading,
      error: null,
      truncated: requestPage.hasMore || observationPage.hasMore,
    };
  }, [loading, requests.data, requests.error, observations.data, observations.error]);
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

/** The candidates in one pool's result. Every row is already inside the source's
 *  cone, of a similar mode and in another active program — the ODB applied all
 *  three. What remains for the client is the de-duplication of the two pools,
 *  see `withoutRequestedObservations`. */
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
    const base = o.targetEnvironment.basePosition;
    const coords = base?.sidereal ?? base?.coordinates;
    const state = o.workflow?.value?.state ?? 'UNDEFINED';
    const raDeg = parseNumber(coords?.ra.degrees) ?? null;
    const decDeg = parseNumber(coords?.dec.degrees) ?? null;
    const programLabel = o.program.reference?.label ?? null;
    const obsRef = o.reference?.label ?? o.id;
    return {
      observationId: o.id,
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
      status: state.charAt(0) + state.slice(1).toLowerCase(),
      target: base?.name ?? '—',
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
  /** Row identity for the table: the candidate's program and trailing label. */
  readonly key: string;
  /** Separation from the source, for display. Null when the candidate's base
   *  position could not be read — the ODB has already judged proximity, so a
   *  row with no separation to show is still a genuine conflict. */
  readonly sepArcsec: number | null;
}

/** The source's candidates as table rows, nearest first. Proximity is not
 *  re-tested: the ODB matched each candidate on the stored J2000 position, while
 *  the coordinates it returns are at the target's own catalogue epoch, so a
 *  comparison here would drop real conflicts. */
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

/*
 * A configuration request carries no target name, only coordinates — the name
 * lives on its applicable observations (sc-10159 items 4-5). We resolve names
 * only for the requests that actually surface as conflict rows (never every
 * candidate fetched), in one id-batched query per section that has request rows.
 * `id: { IN: [...] }` is bounded by the number of displayed rows, so it can't
 * approach Postgres's bind-param limit the way a program-wide fetch could.
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

/** Resolve display target names for the change-request conflict rows: an id →
 *  name map over the union of their applicable observations (sc-10159). Observation
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
 *  names of its applicable observations (from `targetsById`); for an
 *  observation candidate, its own already-known name. "—" when none resolve. */
export function conflictTargetLabel(row: ConflictRow, targetsById: ReadonlyMap<string, string>): string {
  if (row.applicableObservations.length === 0) return row.target;
  return joinTargetNames(row.applicableObservations.map((id) => targetsById.get(id)));
}
