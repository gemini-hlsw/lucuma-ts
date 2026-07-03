import { useSuspenseQuery } from '@apollo/client/react';

import { graphql } from './gen';

export const SERVER_CONFIGURATION_FRAGMENT = graphql(`
  fragment ServerConfigurationItem on ServerConfiguration {
    site
    odbUri
    ssoUri
  }
`);

export const SERVER_CONFIGURATION = graphql(`
  query serverConfiguration {
    serverConfiguration {
      ...ServerConfigurationItem
    }
  }
`);

export function useServerConfiguration() {
  return useSuspenseQuery(SERVER_CONFIGURATION, { errorPolicy: 'all' });
}

export function useServerConfigValue() {
  return useSuspenseQuery(SERVER_CONFIGURATION).data.serverConfiguration;
}
