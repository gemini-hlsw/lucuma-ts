import { InMemoryCache } from '@apollo/client';

/**
 * The app's cache. A target environment has no id, so a query that writes one
 * replaces what another query wrote: the conflict check reads `basePosition`,
 * its target-name lookup reads `firstScienceTarget`, and each wrote the other's
 * answer incomplete and refetched to restore its own. A request's configuration
 * and its observing mode are the same: the change requests page and the conflict
 * check read different parts of them. Merging keeps both; navigate does the same
 * for `Observation.targetEnvironment`.
 */
export const makeCache = (): InMemoryCache =>
  new InMemoryCache({
    typePolicies: {
      Observation: { fields: { targetEnvironment: { merge: true } } },
      ConfigurationRequest: { fields: { configuration: { merge: true } } },
      Configuration: { fields: { observingMode: { merge: true } } },
    },
  });
