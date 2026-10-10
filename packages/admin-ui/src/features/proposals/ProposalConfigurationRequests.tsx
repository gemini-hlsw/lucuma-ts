import { type JSX, useMemo } from 'react';

import { TriangleExclamation } from '@/components/Icons';
import { friendlyError } from '@/gql/errors';
import {
  observationsByIdFrom,
  PROGRAM_CONFIGURATION_REQUESTS_QUERY,
  useProgramConfigurationRequests,
  useProgramObservations,
  useResolveChangeRequests,
} from '@/gql/odb/changeRequests';

import { ConfigurationRequestReview } from '../review/ConfigurationRequestReview';

/**
 * A proposal's configuration requests, approved or denied per request before the
 * proposal itself is decided (sc-9595) — the Change Requests tab's flow, reused.
 * Loaded for the selected proposal only: the Proposals query already walks every
 * program, and a program's requests are not needed until it is opened. Renders
 * nothing while there are none, since most proposals have none, but says so when
 * a query fails: a load error must not read as "nothing to review".
 */
export function ProposalConfigurationRequests({
  programId,
  programLabel,
}: {
  readonly programId: string;
  readonly programLabel: string;
}): JSX.Element | null {
  const { requests, partial, error: requestsError } = useProgramConfigurationRequests(programId);
  // Every observation of the program, paged like the Change Requests tab, so a
  // request's Target and Windows resolve however many observations there are.
  const { matches: observations, error: observationsError } = useProgramObservations(programId);
  const observationsById = useMemo(() => observationsByIdFrom(observations), [observations]);
  // Refetch this program's requests — not the Change Requests list — so the
  // resolved statuses reload in place.
  const { resolve, loading: saving } = useResolveChangeRequests(PROGRAM_CONFIGURATION_REQUESTS_QUERY);

  if (requestsError) {
    return (
      <p className="check-error">
        <TriangleExclamation /> Could not load this proposal’s configuration requests: {friendlyError(requestsError)}
      </p>
    );
  }
  // Nothing until the first load has finished, and nothing while only some pages
  // are in: a partial list must not pass for the whole set, and a loading line
  // would flash on the many proposals that have none. A reload after a resolve
  // keeps what is on screen, so the review is not torn down under the reviewer.
  if (partial || requests.length === 0) return null;
  return (
    <>
      <h3 className="review-obs-title">Configuration Requests</h3>
      {/* With errorPolicy 'all' a benign per-observation warning arrives alongside
          good data, so only an error with nothing loaded counts as a failure. */}
      {observationsError && observations.length === 0 && (
        <p className="check-error">
          <TriangleExclamation /> Could not load the program’s observations, so Target and Windows may be blank:{' '}
          {friendlyError(observationsError)}
        </p>
      )}
      <ConfigurationRequestReview
        requests={requests}
        programLabel={programLabel}
        kind="proposal"
        observationsById={observationsById}
        resetKey={programId}
        saving={saving}
        onResolve={resolve}
      />
    </>
  );
}
