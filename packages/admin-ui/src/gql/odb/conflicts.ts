/*
 * Observation Conflict Check (sc-9243): before approving a new target, check
 * that no other active program is planning an equivalent observation.
 *
 * Two candidate pools:
 *   1. configurationRequests in programs whose active period hasn't ended;
 *   2. observations in those programs, by base coordinate. The story asks for
 *      the observations of Target-of-Opportunity programs, whose configuration
 *      requests carry no coordinates; every active program's observations are
 *      checked instead, because the ODB no longer marks a ToO program in a way a
 *      query can read (the ceiling moved to Program and the reporter's
 *      program, p-1260, reads NONE on dev, see sc-9243), and a duplicate
 *      found is a duplicate whatever the program's ToO status. An observation
 *      that also carries a request in pool 1 is reported once, through the
 *      request.
 *
 * Every filter runs in the ODB, including the coordinate cone (sc-9240): one
 * cone per source, at exactly the story's DISTANCE. The server is therefore the
 * only judge of proximity, which is deliberate — it matches on the stored J2000
 * base position, while the coordinates it hands back are at the target's own
 * catalogue epoch, so re-testing distance here would use a different number and
 * silently drop conflicts for high-proper-motion targets. The separation shown
 * in the table is computed from the returned coordinates for display only.
 *
 * The cone is also what keeps the query answerable at all: resolving a base
 * position for an observation with no targets fails the whole request, and the
 * cone excludes those rows before that can happen.
 *
 * A resolved Target of Opportunity is an ordinary candidate here — it points
 * somewhere definite. One still awaiting its alert has no position anywhere in
 * the ODB, so it is invisible to this check by construction.
 */
import { skipToken, useApolloClient, useQuery } from '@apollo/client/react';
import { isNotNullish, parseNumber } from '@gemini-hlsw/lucuma-common-ui';
import { dateToLocalObservingNight } from '@gemini-hlsw/lucuma-core';
import { useEffect, useMemo, useRef, useState } from 'react';

import { searchRadiusArcsec, separationArcsec } from '@/lib/geminiArchive';

import type { DocumentType } from './gen';
import { graphql } from './gen';
import type { ConfigurationRequestStatus, ObservingModeType, WhereCone } from './gen/graphql';
import { asObservingModeType, formatDec, formatRa, joinTargetNames } from './shared';

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
 * Pool 1 — configuration requests in still-active programs whose reference
 * coordinates fall inside the source's cone.
 *
 * `$cones` is a list because the ODB takes one, but a query carries exactly one:
 * proximity is judged per source, and a result set that pooled several could not
 * say which source each row was found for.
 */
export const CONFLICT_REQUESTS_QUERY = graphql(`
  query AdminConflictRequests($cones: [WhereConfigurationRequest!]!, $modeTypes: [ObservingModeType!]!, $today: Date!) {
    configurationRequests(
      WHERE: {
        program: { activeEnd: { GT: $today } }
        observingModeType: { IN: $modeTypes }
        # A withdrawn request is a dead plan, not a conflict.
        status: { NEQ: WITHDRAWN }
        OR: $cones
      }
      LIMIT: 1000
    ) {
      hasMore
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
  }
`);

/**
 * Pool 2 — observations in still-active programs inside the source's cone. A
 * separate operation from pool 1, which filters a different entity.
 */
export const CONFLICT_OBSERVATIONS_QUERY = graphql(`
  query AdminConflictObservations($cones: [WhereObservation!]!, $modeTypes: [ObservingModeType!]!, $today: Date!) {
    observations(
      WHERE: {
        program: { activeEnd: { GT: $today } }
        observingModeType: { IN: $modeTypes }
        # Science observations only — calibrations aren't conflicts (sc-9591).
        calibrationRole: { IS_NULL: true }
        OR: $cones
      }
      LIMIT: 1000
    ) {
      hasMore
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
        }
        targetEnvironment {
          # The position the telescope would slew to, which is what the story
          # means by the base coordinate. Not firstScienceTarget: its sidereal
          # record is null for a Target of Opportunity, even a resolved one that
          # points somewhere definite, which is how the ToO half of this check
          # came to find nothing.
          basePosition {
            name
            # At most one of these is set, by base position type: a single
            # sidereal target fills sidereal, an asterism composite or an
            # explicit base fills coordinates. A non-sidereal target fills
            # neither, having no fixed position — the cone excludes those rows
            # anyway, so they are read as positionless rather than special-cased.
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
    }
  }
`);

export type AdminConflictRequests = DocumentType<typeof CONFLICT_REQUESTS_QUERY>;
export type AdminConflictObservations = DocumentType<typeof CONFLICT_OBSERVATIONS_QUERY>;

/** A source that can describe a cone. Sources without coordinates raise none,
 *  so they are filtered out before any query is built. */
type PositionedSource = ConflictSource & { readonly raDeg: number; readonly decDeg: number };

/** The cone for one source: the story's DISTANCE rule, expressed once so the
 *  radius the ODB matches on cannot drift from the radius the story specifies. */
function coneFor(source: PositionedSource): { readonly targetCoordinates: WhereCone } {
  return {
    targetCoordinates: {
      center: { ra: { degrees: source.raDeg }, dec: { degrees: source.decDeg } },
      distance: { arcseconds: searchRadiusArcsec(source.modeType) },
    },
  };
}

/** The last check's result, tagged with the key it answers. Loading is derived
 *  (result key ≠ current key), so the effect only ever sets state from its fetch
 *  callbacks — the same shape the sc-9244 duplication check uses. */
interface FetchedCandidates {
  readonly forKey: string;
  readonly candidates: readonly ConflictCandidate[];
  readonly error: Error | null;
  /** A pool hit its LIMIT, so the candidates are incomplete and the table must
   *  not read as an all-clear. */
  readonly truncated: boolean;
}

const NOTHING_FETCHED: FetchedCandidates = { forKey: '', candidates: [], error: null, truncated: false };

/**
 * Fetch both sc-9243 candidate pools, live from the ODB (check-time data —
 * never cached).
 *
 * Driven imperatively rather than through useQuery: a source without
 * coordinates raises no cone, and each of the rest asks its own pair of
 * queries. Hooks cannot be called in a loop, and this check wants neither the
 * cache nor reactivity, so awaiting the queries together keeps one loading
 * flag, one error, and one place where the candidates are assembled.
 */
export function useConflictCandidates(sources: readonly ConflictSource[]) {
  const client = useApolloClient();
  const [fetched, setFetched] = useState<FetchedCandidates>(NOTHING_FETCHED);

  // A source with no coordinates cannot describe a cone, and one with no similar
  // modes has nothing to ask for; both are dropped before any query is built,
  // rather than in matchConflicts, which no longer judges distance at all.
  const askable = sources.filter(
    (s): s is PositionedSource => s.raDeg !== null && s.decDeg !== null && similarModeTypes(s.modeType).length > 0,
  );
  const key =
    askable.length === 0 ? '' : JSON.stringify(askable.map((s) => [s.id, s.programId, s.raDeg, s.decDeg, s.modeType]));

  // Read through a ref so a re-mapped array with identical content doesn't refetch.
  const askableRef = useRef(askable);
  useEffect(() => {
    askableRef.current = askable;
  });

  useEffect(() => {
    if (key === '') return;
    const controller = new AbortController();
    const group = askableRef.current;
    const today = dateToLocalObservingNight(new Date());
    // Each query asks only for its own source's similar modes: one source per
    // query means there is no reason to widen it to the whole selection's.
    const variables = (source: PositionedSource) => ({
      cones: [coneFor(source)],
      modeTypes: [...similarModeTypes(source.modeType)],
      today,
    });
    const context = { fetchOptions: { signal: controller.signal } };

    // One source per query. Proximity is the ODB's judgement, so a result set is
    // only meaningful for the source whose cone produced it — pooling several
    // sources into one query would lose that and report each source the others'
    // conflicts. Well inside the per-operation cone cap as a result.
    Promise.all(
      group.flatMap((source) => [
        client
          .query({
            query: CONFLICT_REQUESTS_QUERY,
            variables: variables(source),
            fetchPolicy: 'network-only',
            context,
          })
          .then((r) => ({ source, data: r.data })),
        client
          .query({
            query: CONFLICT_OBSERVATIONS_QUERY,
            variables: variables(source),
            fetchPolicy: 'network-only',
            context,
          })
          .then((r) => ({ source, data: r.data })),
      ]),
    )
      .then((results) => {
        // A rejected query lands in `catch` rather than here: client.query
        // throws on Apollo's default errorPolicy (ApolloConfigs sets none), so
        // nothing partial slips past. A result with no data is treated the same
        // way: a pool silently missing reads as an all-clear.
        const pools = results.map((r) => {
          if (!isNotNullish(r.data)) throw new Error('The ODB returned no data for a conflict query.');
          return { source: r.source, data: r.data };
        });
        setFetched({
          forKey: key,
          candidates: withoutRequestedObservations(pools.flatMap((r) => mapConflictCandidates(r.source.id, r.data))),
          error: null,
          truncated: pools.some((r) =>
            'configurationRequests' in r.data ? r.data.configurationRequests.hasMore : r.data.observations.hasMore,
          ),
        });
      })
      .catch((err: unknown) => {
        // Aborting unsubscribes the queries, so a late success can never land
        // here — but the abort itself surfaces as a rejection, and reporting it
        // would show an error for a check the user has already moved on from.
        if (controller.signal.aborted) return;
        // Candidates are cleared rather than kept: a partial pool presented as a
        // complete one is how a missed conflict reads as an all-clear.
        setFetched({
          forKey: key,
          candidates: [],
          error: err instanceof Error ? err : new Error(String(err)),
          truncated: false,
        });
      });

    return () => controller.abort();
  }, [client, key]);

  if (key === '') return { candidates: [], loading: false, error: null, truncated: false };
  const current = fetched.forKey === key;
  return {
    candidates: current ? fetched.candidates : [],
    loading: !current,
    error: current ? fetched.error : null,
    truncated: current && fetched.truncated,
  };
}

/** One planned observation elsewhere that could yield equivalent data. */
export interface ConflictCandidate {
  /** The source whose cone returned this candidate. Proximity is the ODB's
   *  judgement, made one source at a time, so a candidate is only ever a
   *  conflict for the source it was found for — without this the pooled
   *  results would cross-match and report candidates for sources nowhere near
   *  them. */
  readonly sourceId: string;
  /** The program's reference label ("G-2027B-1235-Q"), linkable to Explore
   *  (sc-10159 items 1-2). Null only when the program has no reference. */
  readonly programLabel: string | null;
  /** The trailing identifier shown after the program label: the request id
   *  for a configuration request, or the observation's reference/id. */
  readonly detailLabel: string;
  /** The candidate observation's own id; null for a configuration request. */
  readonly observationId: string | null;
  readonly programId: string;
  /** Excluded from matching against itself when the source is a request. */
  readonly requestId: string | null;
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

/** The candidates in one pool's result. Every row is already inside a source's
 *  cone and of a similar mode — the ODB applied both. What remains for the
 *  client is the de-duplication of the two pools, see `withoutRequestedObservations`. */
export function mapConflictCandidates(
  sourceId: string,
  raw: AdminConflictRequests | AdminConflictObservations,
): ConflictCandidate[] {
  return 'observations' in raw ? mapObservationCandidates(sourceId, raw) : mapRequestCandidates(sourceId, raw);
}

function mapRequestCandidates(sourceId: string, raw: AdminConflictRequests): ConflictCandidate[] {
  return raw.configurationRequests.matches.map((c): ConflictCandidate => {
    const coords = c.configuration.target?.coordinates;
    const raDeg = parseNumber(coords?.ra.degrees) ?? null;
    const decDeg = parseNumber(coords?.dec.degrees) ?? null;
    return {
      sourceId,
      programLabel: c.program.reference?.label ?? null,
      detailLabel: c.id,
      observationId: null,
      programId: c.program.id,
      requestId: c.id,
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

function mapObservationCandidates(sourceId: string, raw: AdminConflictObservations): ConflictCandidate[] {
  return raw.observations.matches.map((o): ConflictCandidate => {
    const base = o.targetEnvironment.basePosition;
    const coords = base?.sidereal ?? base?.coordinates;
    const state = o.workflow?.value?.state ?? 'UNDEFINED';
    const raDeg = parseNumber(coords?.ra.degrees) ?? null;
    const decDeg = parseNumber(coords?.dec.degrees) ?? null;
    const programLabel = o.program.reference?.label ?? null;
    const obsRef = o.reference?.label ?? o.id;
    return {
      sourceId,
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
      requestId: null,
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

/** Drop an observation already reported through a configuration request found
 *  for the same source: its request is the candidate the reviewer acts on, and
 *  listing both shows one plan twice. Only a request inside the source's cone is
 *  counted, so an observation whose request lies outside it is kept. A denied
 *  request is no plan to act on, so it does not hide its observation either. */
export function withoutRequestedObservations(candidates: readonly ConflictCandidate[]): ConflictCandidate[] {
  const requested = new Set(
    candidates
      .filter((c) => c.status !== CR_STATUS_LABEL.DENIED)
      .flatMap((c) => c.applicableObservations.map((id) => `${c.sourceId}:${id}`)),
  );
  return candidates.filter((c) => c.observationId === null || !requested.has(`${c.sourceId}:${c.observationId}`));
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
   *  selected sources, so the candidate's own identity is not unique. */
  readonly key: string;
  /** Separation from the source, for display. Null when the candidate's base
   *  position could not be read — the ODB has already judged proximity, so a
   *  row with no separation to show is still a genuine conflict. */
  readonly sepArcsec: number | null;
}

/** Pair each source with the candidates that conflict with it.
 *
 *  Proximity is not re-tested here: the ODB matched each candidate against this
 *  source's cone, on the stored J2000 base position, and the coordinates it
 *  returns are at the target's own catalogue epoch. Comparing those would answer
 *  a slightly different question and, being the narrower test, would drop real
 *  conflicts. What remains is what the ODB cannot express — a candidate is not a
 *  conflict with its own program or itself, and the mode must be similar to this
 *  source's rather than merely to one of the selected sources'. */
export function matchConflicts(
  sources: readonly ConflictSource[],
  candidates: readonly ConflictCandidate[],
): ConflictRow[] {
  const rows: ConflictRow[] = [];
  for (const s of sources) {
    // Kept although the hook already drops these: a source with no coordinates
    // raised no cone, so nothing in `candidates` was matched against it.
    if (s.raDeg === null || s.decDeg === null) continue;
    const similar = new Set<string>(similarModeTypes(s.modeType));
    for (const c of candidates) {
      // Only this source's own cone results: the ODB judged proximity for the
      // source it was asked about, and nothing here can re-derive it.
      if (c.sourceId !== s.id) continue;
      if (c.programId === s.programId || c.requestId === s.id) continue;
      if (c.modeType === null || !similar.has(c.modeType)) continue;
      const sep = c.raDeg === null || c.decDeg === null ? null : separationArcsec(s.raDeg, s.decDeg, c.raDeg, c.decDeg);
      rows.push({ ...c, key: `${s.id}:${c.programId}:${c.detailLabel}`, sepArcsec: sep });
    }
  }
  // Nearest first within each source, then by program and detail label so the order is stable when
  // separations tie or are unknown.
  return rows.sort(
    (a, b) =>
      a.sourceId.localeCompare(b.sourceId) ||
      (a.sepArcsec ?? Infinity) - (b.sepArcsec ?? Infinity) ||
      (a.programLabel ?? a.programId).localeCompare(b.programLabel ?? b.programId) ||
      a.detailLabel.localeCompare(b.detailLabel),
  );
}

/*
 * A configuration request carries no target name, only coordinates — the name
 * lives on its applicable observations (sc-10159 items 4-5). We resolve names
 * only for the requests that actually surface as conflict rows (never every
 * candidate fetched), in one id-batched query. `id: { IN: [...] }` is bounded
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
