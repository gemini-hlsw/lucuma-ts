import { useMutation } from '@apollo/client/react';

import { graphql } from './gen';

const TCS_CONFIG = graphql(`
  mutation ConfigureTcs($config: TcsConfigInput!) {
    tcsConfig(config: $config) {
      result
      msg
    }
  }
`);

export function useConfigureTcs() {
  return useMutation(TCS_CONFIG);
}
