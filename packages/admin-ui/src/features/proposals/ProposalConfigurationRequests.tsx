import { TriangleExclamation, when } from '@gemini-hlsw/lucuma-common-ui';
import { type JSX, useMemo } from 'react';

import { friendlyError } from '@/gql/errors';

import { ConfigurationRequestTable } from '../review/ConfigurationRequestTable';
import type { ProposalRequests } from './useProposalRequests';

/** A proposal's requests, ticked to approve on Accept (sc-9595). Renders nothing
 *  when there are none, but reports a load error so it can't read as "none". */
export function ProposalConfigurationRequests({
  programId,
  proposalRequests,
  declined,
  onDeclinedChange,
  decided,
  locked,
}: {
  readonly programId: string;
  readonly proposalRequests: ProposalRequests;
  /** Ids of the pending requests the reviewer unticked. */
  readonly declined: ReadonlySet<string>;
  readonly onDeclinedChange: (declined: ReadonlySet<string>) => void;
  /** The proposal is decided, so the requests are read-only. */
  readonly decided: boolean;
  /** A resolve is in flight and sends the ticks it started with. */
  readonly locked: boolean;
}): JSX.Element | null {
  const {
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
  } = proposalRequests;

  const approvedIds = useMemo(() => new Set(split(declined).approved), [split, declined]);

  // A walk that cannot finish leaves only some of the requests: say so, rather than show them as all.
  if (requestsError || requestsIncomplete) {
    return (
      <p className="check-error">
        <TriangleExclamation /> Could not load this proposal’s configuration requests
        {requestsError ? <>: {friendlyError(requestsError)}</> : '.'}
      </p>
    );
  }
  // A partial list must not pass for the whole set; a loading line would flash on most proposals.
  if (partial || requests.length === 0) return null;
  return (
    <>
      <h3 className="review-obs-title">Configuration Requests</h3>
      {when(!decided, () => (
        <p className="review-blurb">
          Tick the requests to approve when the proposal is accepted; the other pending ones are denied.
        </p>
      ))}
      {/* With errorPolicy 'all' a benign per-observation warning arrives alongside
          good data, so only an error with nothing loaded counts as a failure. */}
      {when(observationsIncomplete || (observationsError && observations.length === 0), () => (
        <p className="check-error">
          <TriangleExclamation /> Could not load the program’s observations, so Target and Windows may be blank
          {observationsError ? <>: {friendlyError(observationsError)}</> : '.'}
        </p>
      ))}
      <ConfigurationRequestTable
        key={programId}
        requests={requests}
        observationsById={observationsById}
        selection={
          decided
            ? undefined
            : {
                selectedIds: approvedIds,
                isSelectable: (r) => !locked && isPending(r),
                onChange: (ticked) => onDeclinedChange(declinedFrom(ticked)),
              }
        }
      />
    </>
  );
}
