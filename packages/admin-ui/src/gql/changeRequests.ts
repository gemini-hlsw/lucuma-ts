/*
 * Change Requests view (sc-9094): ODB ConfigurationRequest, presented as a
 * program → request master-detail — see ChangeRequestsPage.
 */
import { skipToken, useMutation, useQuery } from '@apollo/client/react';

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
      // Filled in by the page after a second batched query (see
      // OBSERVATIONS_BY_ID_QUERY below) — ConfigurationRequest carries only
      // observation IDs, not the observation rows themselves.
      observations: [],
    };
  });
}

/** Resolve ConfigurationRequest.applicableObservations into observation rows
 *  in one round-trip. */
/** The change-requests list — cached rows render immediately, refreshed in
 *  background. */
export function useChangeRequests() {
  return useQuery(CHANGE_REQUESTS_QUERY, { fetchPolicy: 'cache-and-network' });
}

export const OBSERVATIONS_BY_ID_QUERY = graphql(`
  query AdminObservationsById($ids: [ObservationId!]!) {
    observations(WHERE: { id: { IN: $ids } }, LIMIT: 1000) {
      matches {
        ...ObservationItem
      }
    }
  }
`);

export type AdminObservationsByIdResult = DocumentType<typeof OBSERVATIONS_BY_ID_QUERY>;

export function mapObservationsById(raw: AdminObservationsByIdResult): ReadonlyMap<string, ObservationRow> {
  return new Map(raw.observations.matches.map((o) => [o.id, mapObservationRow(o)]));
}

/** Resolve gathered observation ids to rows in one batched round-trip (a
 *  ConfigurationRequest carries only applicableObservations ids). Skipped
 *  while there's nothing to resolve. */
export function useObservationsByIds(ids: readonly string[]) {
  return useQuery(OBSERVATIONS_BY_ID_QUERY, ids.length === 0 ? skipToken : { variables: { ids: [...ids] } });
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
