import { useQuery } from '@apollo/client/react';
import type { OptionsOf } from '@gql/util';

import { graphql } from './gen';

export const SERVER_CONFIGURATION_FRAGMENT = graphql(`
  fragment ServerConfigurationItem on ServerConfiguration {
    version
    site
    odbUri
    ssoUri
  }
`);

const SERVER_CONFIGURATION = graphql(`
  query serverConfiguration {
    serverConfiguration {
      ...ServerConfigurationItem
    }
  }
`);

export function useServerConfiguration(options: OptionsOf<typeof SERVER_CONFIGURATION> = {}) {
  return useQuery(SERVER_CONFIGURATION, options);
}
