/*
 * Change Requests view (sc-9094): ODB ConfigurationRequest, presented as a
 * program → request master-detail — see ChangeRequestsPage.
 */
import { skipToken, useMutation, useQuery } from '@apollo/client/react';
import { isNullish, parseNumber, useAllPages } from '@gemini-hlsw/lucuma-common-ui';
import type { DocumentNode } from 'graphql';
import { useCallback, useMemo } from 'react';

import type {
  ChangeRequest,
  ConfigurationRequestStatus,
  ObservationRow,
  ProgramCrStatus,
  ProgramWithChangeRequests,
  Site,
} from '../types';
import { graphql } from './gen';
import type { ConfigurationRequestItemFragment, Instrument, ObservationItemFragment } from './gen/graphql';
import { formatConditions, formatDec, formatRa, isScienceObservation, mapObservationRow } from './shared';

/** One ConfigurationRequest as both review views render it — the Change
 *  Requests tab (sc-9094) and the Proposals tab's per-CR approve/deny (sc-9595).
 *  A named fragment so `mapConfigurationRequests` maps requests whether they
 *  arrive via the top-level `configurationRequests` query or a program's own
 *  `configurationRequests` field. */
export const CONFIGURATION_REQUEST_FRAGMENT = graphql(`
  fragment ConfigurationRequestItem on ConfigurationRequest {
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
`);

export const CHANGE_REQUESTS_QUERY = graphql(`
  query AdminChangeRequests($offset: ConfigurationRequestId) {
    # Only requests on accepted programs (sc-9601) — a change request against a
    # merely-submitted proposal isn't actionable here. Mirrors the Programs
    # query's proposalStatus filter. Paged via the OFFSET_AT cursor (sc-9604):
    # a single fixed LIMIT silently dropped requests past the first page — a
    # newly-submitted one, landing at the tail, went missing — so
    # useChangeRequests follows hasMore to the end.
    configurationRequests(WHERE: { program: { proposalStatus: { EQ: ACCEPTED } } }, OFFSET_AT: $offset) {
      matches {
        ...ConfigurationRequestItem
      }
      hasMore
    }
  }
`);

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

/** Map raw ConfigurationRequest rows onto the view shape, from either source
 *  (the CR query or one program's requests). `observations` is left empty here —
 *  a request carries only observation ids; the review panel fills the rows from
 *  the program's observations (see useProgramObservations). */
export function mapConfigurationRequests(matches: readonly ConfigurationRequestItemFragment[]): ChangeRequest[] {
  return matches.map((c): ChangeRequest => {
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
      observations: [],
    };
  });
}

/** The change-requests list — cached rows render immediately, refreshed in
 *  background. Follows the ODB's `hasMore` cursor to the last page (sc-9604)
 *  so no request is ever dropped by a page limit; the returned `data` grows as
 *  pages arrive and `loading` stays true until the final page is in; `incomplete`
 *  says a page could not be had (`useAllPages`). */
export function useChangeRequests() {
  const result = useQuery(CHANGE_REQUESTS_QUERY, {
    variables: { offset: null },
    fetchPolicy: 'cache-and-network',
    notifyOnNetworkStatusChange: true,
  });
  return useAllPages(result, 'configurationRequests');
}

/** One program's configuration requests, for the Proposals detail (sc-9595),
 *  where the proposal is decided before it is accepted and so is not in the
 *  accepted-programs list above. Loaded for the selected proposal only, rather
 *  than under every program of the Proposals query, which already walks them all. */
export const PROGRAM_CONFIGURATION_REQUESTS_QUERY = graphql(`
  query AdminProgramConfigurationRequests($programId: ProgramId!, $offset: ConfigurationRequestId) {
    configurationRequests(WHERE: { program: { id: { EQ: $programId } } }, OFFSET_AT: $offset) {
      matches {
        ...ConfigurationRequestItem
      }
      hasMore
    }
  }
`);

/** The selected program's requests, following `hasMore` to the last page with
 *  `useAllPages`, like the other walks here, so none is dropped by a page limit.
 *  `partial` is true while pages are still to come, and stays true if the walk
 *  cannot finish (`incomplete`), so a partial list never passes for the whole set.
 *  Skipped when no program is selected. */
export function useProgramConfigurationRequests(programId: string | null) {
  const result = useQuery(
    PROGRAM_CONFIGURATION_REQUESTS_QUERY,
    isNullish(programId)
      ? skipToken
      : // cache-and-network, like the other request walks: a proposal reopened
        // later must not show requests that were resolved in the meantime.
        { variables: { programId, offset: null }, fetchPolicy: 'cache-and-network', notifyOnNetworkStatusChange: true },
  );
  const { data, loading, incomplete, error } = useAllPages(result, 'configurationRequests');
  const requests = useMemo(() => (data ? mapConfigurationRequests(data.configurationRequests.matches) : []), [data]);
  return { requests, error, loading, incomplete, partial: data?.configurationRequests.hasMore ?? false };
}

/*
 * A ConfigurationRequest carries only observation ids (applicableObservations),
 * so the page resolves them to rows. We fetch the selected program's
 * observations page-by-page (WHERE program + OFFSET_AT cursor, following the
 * pagination pattern in explore's ProgramSummaryQueries) rather than sending one
 * `id: { IN: [...] }` list: a program with thousands of observations would blow
 * past Postgres's 32,767 bind-parameter limit and the ODB would 500. Paging
 * keeps every request bounded and never silently truncates.
 */
export const PROGRAM_OBSERVATIONS_QUERY = graphql(`
  query AdminProgramObservations($programId: ProgramId!, $offset: ObservationId) {
    observations(WHERE: { program: { id: { EQ: $programId } } }, OFFSET_AT: $offset) {
      matches {
        ...ObservationItem
      }
      hasMore
    }
  }
`);

export function observationsByIdFrom(matches: readonly ObservationItemFragment[]): ReadonlyMap<string, ObservationRow> {
  // Science observations only — calibration ("system") observations aren't
  // part of the requested science and shouldn't appear or be duplicate-checked
  // (sc-9591).
  return new Map(matches.filter(isScienceObservation).map((o) => [o.id, mapObservationRow(o)]));
}

/** Load every observation in `programId`, following the ODB's `hasMore` cursor
 *  so no page limit can silently drop rows. Returns the accumulated matches once
 *  the last page has loaded; `loading` stays true until then, and `incomplete` says
 *  a page could not be had. Skipped when no
 *  program is selected. */
export function useProgramObservations(programId: string | null): {
  matches: readonly ObservationItemFragment[];
  error: Error | undefined;
  loading: boolean;
  incomplete: boolean;
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

  const { data, loading, incomplete } = useAllPages(result, 'observations');
  return { matches: data?.observations.matches ?? [], error: result.error, loading, incomplete };
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

/** Resolve the requests, writing `response` as the staff feedback.
 *
 *  A null `response` means the reviewer left no response, which keeps whatever
 *  is stored rather than erasing it — the two cases need different documents,
 *  since a nulled variable clears the field. `refetchQuery` is the list the
 *  calling view reads from, so the resolved statuses reload in place — the Change
 *  Requests query for that tab, or one program's own requests query for the
 *  per-request approval in the Proposals detail (sc-9595). */
export function useResolveChangeRequests(refetchQuery: DocumentNode = CHANGE_REQUESTS_QUERY) {
  const options = useMemo(() => ({ refetchQueries: [refetchQuery], awaitRefetchQueries: true }), [refetchQuery]);
  const [withFeedback, withState] = useMutation(RESOLVE_WITH_FEEDBACK_MUTATION, options);
  const [keepingFeedback, keepState] = useMutation(RESOLVE_KEEPING_FEEDBACK_MUTATION, options);
  const resolve = useCallback(
    (ids: readonly string[], status: ConfigurationRequestStatus, response: string | null) =>
      response === null
        ? keepingFeedback({ variables: { ids: [...ids], status } })
        : withFeedback({ variables: { ids: [...ids], status, feedback: response } }),
    [withFeedback, keepingFeedback],
  );
  return { resolve, loading: withState.loading || keepState.loading };
}
