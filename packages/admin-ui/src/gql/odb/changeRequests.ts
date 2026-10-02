/*
 * Change Requests view (sc-9094): ODB ConfigurationRequest, presented as a
 * program → request master-detail — see ChangeRequestsPage.
 */
import { skipToken, useMutation, useQuery } from '@apollo/client/react';
import { parseNumber } from '@gemini-hlsw/lucuma-common-ui';
import { useCallback, useEffect } from 'react';

import type {
  ChangeRequest,
  ConfigurationRequestStatus,
  ObservationRow,
  ProgramCrStatus,
  ProgramWithChangeRequests,
  Site,
} from '../types';
import type { DocumentType } from './gen';
import { graphql } from './gen';
import type { Instrument } from './gen/graphql';
import { formatConditions, formatDec, formatRa, isScienceObservation, mapObservationRow } from './shared';

export const CHANGE_REQUESTS_QUERY = graphql(`
  query AdminChangeRequests($offset: ConfigurationRequestId) {
    # Only requests on accepted programs (sc-9601) — a change request against a
    # merely-submitted proposal isn't actionable here. Mirrors the Programs
    # query's proposalStatus filter. Paged via the OFFSET cursor (sc-9604):
    # a single fixed LIMIT silently dropped requests past the first page — a
    # newly-submitted one, landing at the tail, went missing — so
    # useChangeRequests follows hasMore to the end.
    configurationRequests(WHERE: { program: { proposalStatus: { EQ: ACCEPTED } } }, OFFSET: $offset) {
      matches {
        id
        status
        justification
        feedback
        createdAt
        applicableObservations
        program {
          id
          name
          reference {
            label
          }
          pi {
            id
            user {
              id
              profile {
                givenName
                familyName
              }
            }
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
            instrument
            mode
          }
          conditions {
            imageQuality
            cloudExtinction
            skyBackground
            waterVapor
          }
        }
      }
      hasMore
    }
  }
`);

export type AdminChangeRequestsResult = DocumentType<typeof CHANGE_REQUESTS_QUERY>;

/** Gemini instrument enum → display label + site. Instruments not listed here
 *  (e.g. visiting instruments) default to North, since that's unverifiable
 *  from the enum alone — flagged via the label itself. */
const INSTRUMENT_SITE: Partial<Record<Instrument, { label: string; site: Site }>> = {
  GMOS_NORTH: { label: 'GMOS-N', site: 'NORTH' },
  GMOS_SOUTH: { label: 'GMOS-S', site: 'SOUTH' },
  FLAMINGOS2: { label: 'Flamingos-2', site: 'SOUTH' },
  GNIRS: { label: 'GNIRS', site: 'NORTH' },
  IGRINS2: { label: 'IGRINS-2', site: 'NORTH' },
};

export function mapChangeRequests(raw: AdminChangeRequestsResult): ChangeRequest[] {
  return raw.configurationRequests.matches.map((c): ChangeRequest => {
    const prof = c.program.pi?.user?.profile;
    const coords = c.configuration.target?.coordinates;
    const instrument = c.configuration.observingMode?.instrument;
    const site = (instrument && INSTRUMENT_SITE[instrument]) ?? {
      label: instrument ?? '(unknown)',
      site: 'NORTH' as Site,
    };
    const raDeg = parseNumber(coords?.ra.degrees) ?? null;
    const decDeg = parseNumber(coords?.dec.degrees) ?? null;
    return {
      id: c.id,
      programId: c.program.id,
      // Reviewers know programs by reference label ("G-2027B-1234-Q"), not the
      // internal id — fall back to the id for programs never given a reference.
      programReference: c.program.reference?.label ?? c.program.id,
      programTitle: c.program.name ?? '(untitled)',
      pi: [prof?.givenName, prof?.familyName].filter(Boolean).join(' ') || '(unknown PI)',
      status: c.status,
      justification: c.justification ?? '',
      feedback: c.feedback ?? '',
      createdAt: c.createdAt,
      site: site.site,
      ra: raDeg === null ? '—' : formatRa(raDeg),
      dec: decDeg === null ? '—' : formatDec(decDeg),
      raDeg,
      decDeg,
      modeType: c.configuration.observingMode?.mode ?? null,
      instrument: site.label,
      conditions: formatConditions(c.configuration.conditions),
      observationIds: c.applicableObservations,
      // Filled in by the page from the program's observations (see
      // useProgramObservations) — ConfigurationRequest carries only observation
      // IDs, not the observation rows themselves.
      observations: [],
    };
  });
}

/** The change-requests list — cached rows render immediately, refreshed in
 *  background. Follows the ODB's `hasMore` cursor to the last page (sc-9604)
 *  so no request is ever dropped by a page limit; the returned `data` grows as
 *  pages arrive and `loading` stays true until the final page is in. */
export function useChangeRequests() {
  const result = useQuery(CHANGE_REQUESTS_QUERY, {
    variables: { offset: null },
    fetchPolicy: 'cache-and-network',
    notifyOnNetworkStatusChange: true,
  });

  const { data, fetchMore } = result;

  // Walk the remaining pages: each fetchMore appends the next page's matches
  // (merged via updateQuery, since the cache has no field policy for this list),
  // using the last loaded id as the cursor, until the ODB reports no more.
  useEffect(() => {
    if (!data?.configurationRequests.hasMore || fetchMore === undefined) return;
    const matches = data.configurationRequests.matches;
    const cursor = matches[matches.length - 1]?.id;
    if (cursor === undefined) return;
    void fetchMore({
      variables: { offset: cursor },
      updateQuery: (prev, { fetchMoreResult }) => ({
        configurationRequests: {
          ...fetchMoreResult.configurationRequests,
          matches: [...prev.configurationRequests.matches, ...fetchMoreResult.configurationRequests.matches],
        },
      }),
    });
  }, [data, fetchMore]);

  return {
    ...result,
    // Not settled until every page is in, so callers don't render a partial set.
    loading: result.loading || (data?.configurationRequests.hasMore ?? false),
  };
}

/*
 * A ConfigurationRequest carries only observation ids (applicableObservations),
 * so the page resolves them to rows. We fetch the selected program's
 * observations page-by-page (WHERE program + OFFSET cursor, following the
 * pagination pattern in explore's ProgramSummaryQueries) rather than sending one
 * `id: { IN: [...] }` list: a program with thousands of observations would blow
 * past Postgres's 32,767 bind-parameter limit and the ODB would 500. Paging
 * keeps every request bounded and never silently truncates.
 */
export const PROGRAM_OBSERVATIONS_QUERY = graphql(`
  query AdminProgramObservations($programId: ProgramId!, $offset: ObservationId) {
    observations(WHERE: { program: { id: { EQ: $programId } } }, OFFSET: $offset) {
      matches {
        ...ObservationItem
      }
      hasMore
    }
  }
`);

export type AdminProgramObservationsResult = DocumentType<typeof PROGRAM_OBSERVATIONS_QUERY>;
type ObservationMatch = AdminProgramObservationsResult['observations']['matches'][number];

export function observationsByIdFrom(matches: readonly ObservationMatch[]): ReadonlyMap<string, ObservationRow> {
  // Science observations only — calibration ("system") observations aren't
  // part of the requested science and shouldn't appear or be duplicate-checked
  // (sc-9591).
  return new Map(matches.filter(isScienceObservation).map((o) => [o.id, mapObservationRow(o)]));
}

/** Load every observation in `programId`, following the ODB's `hasMore` cursor
 *  so no page limit can silently drop rows. Returns the accumulated matches once
 *  the last page has loaded; `loading` stays true until then. Skipped when no
 *  program is selected. */
export function useProgramObservations(programId: string | null): {
  matches: readonly ObservationMatch[];
  loading: boolean;
} {
  const result = useQuery(
    PROGRAM_OBSERVATIONS_QUERY,
    // errorPolicy 'all': the ObservationItem digest is computed per observation
    // and a single un-costable one returns null plus an entry in `errors`; the
    // default 'none' would discard the whole page over one warning (sc-10153).
    programId === null
      ? skipToken
      : { variables: { programId, offset: null }, notifyOnNetworkStatusChange: true, errorPolicy: 'all' },
  );

  const { data, fetchMore } = result;

  // Walk the remaining pages: each fetchMore appends the next page's matches
  // (merged via updateQuery, since the cache has no field policy for this list),
  // using the last loaded id as the cursor, until the ODB reports no more.
  useEffect(() => {
    if (!data?.observations.hasMore || fetchMore === undefined) return;
    const matches = data.observations.matches;
    const cursor = matches[matches.length - 1]?.id;
    if (cursor === undefined) return;
    void fetchMore({
      variables: { offset: cursor },
      updateQuery: (prev, { fetchMoreResult }) => ({
        observations: {
          ...fetchMoreResult.observations,
          matches: [...prev.observations.matches, ...fetchMoreResult.observations.matches],
        },
      }),
    });
  }, [data, fetchMore]);

  return {
    matches: data?.observations.matches ?? [],
    // Not settled until every page is in, so callers don't render a partial set.
    loading: result.loading || (data?.observations.hasMore ?? false),
  };
}

/** Resolve the requests and write the reviewer's response to `feedback`.
 *
 *  Paired with `RESOLVE_KEEPING_FEEDBACK_MUTATION`, which omits the field. The
 *  two cannot be one document: a `$feedback` variable passed as null *clears*
 *  the stored note rather than leaving it alone (verified against dev), so
 *  "no response this time" has to be said by leaving the field out of SET. */
export const RESOLVE_WITH_FEEDBACK_MUTATION = graphql(`
  mutation AdminResolveChangeRequests(
    $ids: [ConfigurationRequestId!]!
    $status: ConfigurationRequestStatus!
    $feedback: NonEmptyString
  ) {
    updateConfigurationRequests(input: { WHERE: { id: { IN: $ids } }, SET: { status: $status, feedback: $feedback } }) {
      requests {
        id
        status
        feedback
      }
    }
  }
`);

/** Resolve the requests without touching the stored response. Every field of
 *  `ConfigurationRequestProperties` is optional and an omitted one is left as
 *  it was, so re-resolving cannot silently discard a note written earlier,
 *  possibly by someone else. */
export const RESOLVE_KEEPING_FEEDBACK_MUTATION = graphql(`
  mutation AdminResolveChangeRequestsKeepingFeedback(
    $ids: [ConfigurationRequestId!]!
    $status: ConfigurationRequestStatus!
  ) {
    updateConfigurationRequests(input: { WHERE: { id: { IN: $ids } }, SET: { status: $status } }) {
      requests {
        id
        status
        feedback
      }
    }
  }
`);

/** Group change requests by program and synthesize each program's overall
 *  Status per the sc-9094 mockup: Approved = all approved, Denied = all
 *  denied, Open = at least one REQUESTED, Mixed = a mix of approved/denied
 *  with none left open. */
export function groupChangeRequestsByProgram(requests: readonly ChangeRequest[]): ProgramWithChangeRequests[] {
  const byProgram = new Map<string, ChangeRequest[]>();
  for (const r of requests) {
    const group = byProgram.get(r.programId);
    if (group) group.push(r);
    else byProgram.set(r.programId, [r]);
  }
  return Array.from(byProgram.values()).map((reqs) => {
    const first = reqs[0]!;
    const statuses = new Set<ConfigurationRequestStatus>(reqs.map((r) => r.status));
    const uniform = statuses.size === 1 ? [...statuses][0] : undefined;
    const status: ProgramCrStatus = statuses.has('REQUESTED')
      ? 'Open'
      : uniform === 'APPROVED'
        ? 'Approved'
        : uniform === 'DENIED'
          ? 'Denied'
          : 'Mixed';
    return {
      programId: first.programId,
      programReference: first.programReference,
      programTitle: first.programTitle,
      pi: first.pi,
      // The set of sites the program's requests span — not just the first
      // request's — so the site filter matches a dual-site program at both (sc-9606).
      sites: new Set(reqs.map((r) => r.site)),
      status,
      requests: reqs,
    };
  });
}

const RESOLVE_OPTIONS = { refetchQueries: [CHANGE_REQUESTS_QUERY], awaitRefetchQueries: true };

/** Resolve the selected requests, writing `response` as the staff feedback.
 *
 *  A null `response` means the reviewer left no response, which keeps whatever
 *  is stored rather than erasing it — the two cases need different documents,
 *  since a nulled variable clears the field. */
export function useResolveChangeRequests() {
  const [withFeedback, withState] = useMutation(RESOLVE_WITH_FEEDBACK_MUTATION, RESOLVE_OPTIONS);
  const [keepingFeedback, keepState] = useMutation(RESOLVE_KEEPING_FEEDBACK_MUTATION, RESOLVE_OPTIONS);
  const resolve = useCallback(
    (ids: readonly string[], status: ConfigurationRequestStatus, response: string | null) =>
      response === null
        ? keepingFeedback({ variables: { ids: [...ids], status } })
        : withFeedback({ variables: { ids: [...ids], status, feedback: response } }),
    [withFeedback, keepingFeedback],
  );
  return { resolve, loading: withState.loading || keepState.loading };
}
