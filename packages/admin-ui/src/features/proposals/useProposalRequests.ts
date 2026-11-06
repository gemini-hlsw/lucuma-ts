import { useMemo } from 'react';

import {
  observationsByIdFrom,
  useProgramConfigurationRequests,
  useProgramObservations,
} from '@/gql/odb/changeRequests';

/**
 * A proposal's configuration requests with the observations that fill in their
 * Target and Windows columns (sc-9595). Loaded for the selected proposal only:
 * the Proposals query already walks every program, and a program's requests are
 * not needed until it is opened.
 *
 * `ready` says the request list can be trusted as the whole set: loaded, with no
 * error and no page still to come. Accepting a proposal approves and denies the
 * requests on screen, so it must not run on a list that may be missing some.
 * `partial` also covers a walk that cannot finish (`incomplete`), which stops
 * `loading` but leaves `hasMore` set.
 */
export function useProposalRequests(programId: string | null) {
  const {
    requests,
    loading,
    partial,
    incomplete: requestsIncomplete,
    error: requestsError,
  } = useProgramConfigurationRequests(programId);
  // Every observation of the program, paged like the Change Requests tab, so a
  // request's Target and Windows resolve however many observations there are.
  const {
    matches: observations,
    incomplete: observationsIncomplete,
    error: observationsError,
  } = useProgramObservations(programId);
  const observationsById = useMemo(() => observationsByIdFrom(observations), [observations]);

  return {
    requests,
    requestsError,
    requestsIncomplete,
    partial,
    observations,
    observationsById,
    observationsError,
    observationsIncomplete,
    ready: !loading && !partial && !requestsError,
  };
}

export type ProposalRequests = ReturnType<typeof useProposalRequests>;
