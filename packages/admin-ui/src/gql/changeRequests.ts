/*
 * Change Requests view (sc-9094): ODB ConfigurationRequest, presented as a
 * program → request master-detail — see ChangeRequestsPage.
 */
import { skipToken, useMutation, useQuery } from '@apollo/client/react';
import { useEffect } from 'react';

import type { DocumentType } from './odb/gen';
import { graphql } from './odb/gen';
import type { Instrument } from './odb/gen/graphql';
import { formatConditions, mapObservationRow } from './shared';
import type {
  ChangeRequest,
  ConfigurationRequestStatus,
  ObservationRow,
  ProgramCrStatus,
  ProgramWithChangeRequests,
  Site,
} from './types';

export const CHANGE_REQUESTS_QUERY = graphql(`
  query AdminChangeRequests {
    configurationRequests(LIMIT: 200) {
      matches {
        id
        status
        justification
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
      site: site.site,
      ra: coords?.ra.hms ?? '—',
      dec: coords?.dec.dms ?? '—',
      raDeg: coords ? Number(coords.ra.degrees) : null,
      decDeg: coords ? Number(coords.dec.degrees) : null,
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
 *  background. */
export function useChangeRequests() {
  return useQuery(CHANGE_REQUESTS_QUERY, { fetchPolicy: 'cache-and-network' });
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
  return new Map(matches.map((o) => [o.id, mapObservationRow(o)]));
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
    programId === null ? skipToken : { variables: { programId, offset: null }, notifyOnNetworkStatusChange: true },
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

export const UPDATE_CONFIGURATION_REQUESTS_MUTATION = graphql(`
  mutation AdminResolveChangeRequests($ids: [ConfigurationRequestId!]!, $status: ConfigurationRequestStatus!) {
    updateConfigurationRequests(input: { WHERE: { id: { IN: $ids } }, SET: { status: $status } }) {
      requests {
        id
        status
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
      site: first.site,
      status,
      requests: reqs,
    };
  });
}

export function useUpdateConfigurationRequests() {
  return useMutation(UPDATE_CONFIGURATION_REQUESTS_MUTATION, {
    refetchQueries: [CHANGE_REQUESTS_QUERY],
    awaitRefetchQueries: true,
  });
}
