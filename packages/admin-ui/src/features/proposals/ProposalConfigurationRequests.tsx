import { TriangleExclamation } from '@gemini-hlsw/lucuma-common-ui';
import { type JSX, useMemo } from 'react';

import { friendlyError } from '@/gql/errors';

import { ConfigurationRequestTable } from '../review/ConfigurationRequestTable';
import type { ProposalRequests } from './useProposalRequests';

/**
 * A proposal's configuration requests, ticked to be approved when the proposal
 * is accepted (sc-9595). The ones left unticked are denied then, and a rejected
 * proposal leaves them all alone; the page applies that, this only draws the
 * choice. Every pending request starts ticked.
 *
 * Renders nothing while there are none, since most proposals have none, but says
 * so when a query fails: a load error must not read as "nothing to review".
 */
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
  /** The proposal already has its decision, so the requests are only shown. */
  readonly decided: boolean;
  /** A resolve is in flight: what was ticked when it started is what it sends, so the ticks stay as they are. */
  readonly locked: boolean;
}): JSX.Element | null {
  const {
    requests,
    requestsError,
    requestsIncomplete,
    partial,
    observations,
    observationsById,
    observationsError,
    observationsIncomplete,
  } = proposalRequests;

  const pending = useMemo(() => requests.filter((r) => r.status === 'REQUESTED'), [requests]);
  const approvedIds = useMemo(
    () => new Set(pending.filter((r) => !declined.has(r.id)).map((r) => r.id)),
    [pending, declined],
  );

  // A walk that cannot finish leaves only some of the requests: say so, rather than show them as all.
  if (requestsError || requestsIncomplete) {
    return (
      <p className="check-error">
        <TriangleExclamation /> Could not load this proposal’s configuration requests
        {requestsError ? <>: {friendlyError(requestsError)}</> : '.'}
      </p>
    );
  }
  // Nothing until the first load has finished, and nothing while only some pages
  // are in: a partial list must not pass for the whole set, and a loading line
  // would flash on the many proposals that have none. A reload after accepting
  // keeps what is on screen, so the outcome shows in place.
  if (partial || requests.length === 0) return null;
  return (
    <>
      <h3 className="review-obs-title">Configuration Requests</h3>
      {!decided && (
        <p className="review-blurb">
          Tick the requests to approve when the proposal is accepted; the other pending ones are denied.
        </p>
      )}
      {/* With errorPolicy 'all' a benign per-observation warning arrives alongside
          good data, so only an error with nothing loaded counts as a failure. */}
      {(observationsIncomplete || (observationsError && observations.length === 0)) && (
        <p className="check-error">
          <TriangleExclamation /> Could not load the program’s observations, so Target and Windows may be blank
          {observationsError ? <>: {friendlyError(observationsError)}</> : '.'}
        </p>
      )}
      <ConfigurationRequestTable
        key={programId}
        requests={requests}
        observationsById={observationsById}
        selection={
          decided
            ? undefined
            : {
                selectedIds: approvedIds,
                isSelectable: (r) => !locked && r.status === 'REQUESTED',
                onChange: (ticked) =>
                  onDeclinedChange(new Set(pending.filter((r) => !ticked.has(r.id)).map((r) => r.id))),
              }
        }
      />
    </>
  );
}
