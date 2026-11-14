import { useCallback, useMemo, useState } from 'react';

import {
  observationsByIdFrom,
  useProgramConfigurationRequests,
  useProgramObservations,
} from '@/gql/odb/changeRequests';
import type { ChangeRequest } from '@/gql/types';

/** The selected proposal's requests and observations (sc-9595). `isPending`,
 *  `declinedFrom` and `split` are the single rule for what Accept decides. */
export function useProposalRequests(programId: string | null) {
  const {
    requests: walked,
    loading,
    partial: walking,
    incomplete: requestsIncomplete,
    error: requestsError,
  } = useProgramConfigurationRequests(programId);
  // A reload restarts the page walk at page one (measured: the table blinked out),
  // so the program's last whole list stays on screen until the walk is done.
  const [whole, setWhole] = useState<{ programId: string | null; requests: readonly ChangeRequest[] } | null>(null);
  if (!walking && (whole?.requests !== walked || whole.programId !== programId)) {
    setWhole({ programId, requests: walked });
  }
  const held = walking && whole?.programId === programId ? whole.requests : null;
  const requests = held ?? walked;
  const partial = walking && !held;
  // Paged, so Target and Windows resolve however many observations there are.
  const {
    matches: observations,
    incomplete: observationsIncomplete,
    error: observationsError,
  } = useProgramObservations(programId);
  const observationsById = useMemo(() => observationsByIdFrom(observations), [observations]);

  const pending = useMemo(() => requests.filter(isPending), [requests]);
  /** The pending requests left unticked, given the ticked ids. */
  const declinedFrom = useCallback(
    (ticked: ReadonlySet<string>): ReadonlySet<string> =>
      new Set(pending.filter((r) => !ticked.has(r.id)).map((r) => r.id)),
    [pending],
  );
  /** Pending ids Accept approves and denies. */
  const split = useCallback(
    (declined: ReadonlySet<string>) => ({
      approved: pending.filter((r) => !declined.has(r.id)).map((r) => r.id),
      denied: pending.filter((r) => declined.has(r.id)).map((r) => r.id),
    }),
    [pending],
  );

  return {
    requests,
    isPending,
    declinedFrom,
    split,
    requestsError,
    requestsIncomplete,
    partial,
    observations,
    observationsById,
    observationsError,
    observationsIncomplete,
    // Observations only fill display columns, so they don't hold Accept back.
    // `walking`, not the displayed `partial`: a held list must not pass for a fresh one.
    ready: !loading && !walking && !requestsError && !requestsIncomplete,
  };
}

/** A request Accept decides: one still awaiting a decision. */
function isPending(request: ChangeRequest): boolean {
  return request.status === 'REQUESTED';
}

export type ProposalRequests = ReturnType<typeof useProposalRequests>;
