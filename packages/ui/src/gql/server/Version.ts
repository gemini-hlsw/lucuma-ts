import { useQuery, useSuspenseQuery } from '@apollo/client/react';
import type { OptionsOf } from '@gql/util';

import { graphql } from './gen';

export const GET_VERSION = graphql(`
  query Version {
    serverVersion
  }
`);

export function useVersion(options?: OptionsOf<typeof GET_VERSION>) {
  return useQuery(GET_VERSION, options);
}

export function useSuspenseVersion() {
  return useSuspenseQuery(GET_VERSION);
}
