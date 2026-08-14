import { useMutation } from '@apollo/client/react';

import { graphql } from './gen/gql';

export const REFRESH_EPHEMERIS_FILES_MUTATION = graphql(`
  mutation RefreshEphemerisFiles($observingNight: Date!) {
    refreshEphemerisFiles(observingNight: $observingNight) {
      result
      msg
    }
  }
`);

export function useRefreshEphemerisFiles() {
  return useMutation(REFRESH_EPHEMERIS_FILES_MUTATION);
}
