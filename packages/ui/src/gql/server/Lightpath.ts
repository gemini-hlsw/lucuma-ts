import { useMutation } from '@apollo/client/react';

import { graphql } from './gen';

export const LIGHTPATH_CONFIG_MUTATION = graphql(`
  mutation lightpathConfig($from: LightSource!, $to: LightSink!) {
    lightpathConfig(from: $from, to: $to) {
      result
      msg
    }
  }
`);

export function useLightpathConfig() {
  return useMutation(LIGHTPATH_CONFIG_MUTATION);
}
