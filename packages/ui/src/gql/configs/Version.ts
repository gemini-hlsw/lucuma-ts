import { skipToken, useQuery, useSuspenseQuery } from '@apollo/client/react';
import type { OptionsOf } from '@gql/util';

import { graphql } from './gen';

export const GET_VERSION = graphql(`
  query version {
    version {
      serverVersion
      schemaVersion
    }
  }
`);

export function useVersion(options?: OptionsOf<typeof GET_VERSION>) {
  return useQuery(
    GET_VERSION,
    options === skipToken
      ? skipToken
      : {
          ...options,
          context: { clientName: 'navigateConfigs' },
        },
  );
}

export function useSuspenseVersion() {
  return useSuspenseQuery(GET_VERSION, { context: { clientName: 'navigateConfigs' } });
}
