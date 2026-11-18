import { InMemoryCache } from '@apollo/client';

/** The app's cache. These objects have no id, so queries reading different fields of
 *  one would overwrite each other and refetch; merging keeps both. */
export const makeCache = (): InMemoryCache =>
  new InMemoryCache({
    typePolicies: {
      Observation: { fields: { targetEnvironment: { merge: true } } },
      ConfigurationRequest: { fields: { configuration: { merge: true } } },
      Configuration: { fields: { observingMode: { merge: true } } },
    },
  });
