import { useMutation, useQuery } from '@apollo/client/react';

import { graphql } from './gen';

export const ALTAIR_INSTRUMENT_FRAGMENT = graphql(`
  fragment AltairInstrumentItem on AltairInstrument {
    pk
    beamsplitter
    startMagnitude
    seeing
    windSpeed
    forceMode
    ndFilter
    fieldLens
    deployAdc
    adjustAdc
    lgs
  }
`);

const GET_ALTAIR_INSTRUMENT = graphql(`
  query AltairInstrument {
    altairInstrument {
      ...AltairInstrumentItem
    }
  }
`);

export function useAltairInstrument() {
  return useQuery(GET_ALTAIR_INSTRUMENT, {
    context: { clientName: 'navigateConfigs' },
  });
}

const UPDATE_ALTAIR_INSTRUMENT = graphql(`
  mutation UpdateAltairInstrument(
    $pk: PosInt!
    $beamsplitter: String
    $startMagnitude: Float
    $seeing: Float
    $windSpeed: Float
    $forceMode: Boolean
    $ndFilter: Boolean
    $fieldLens: Boolean
    $deployAdc: Boolean
    $adjustAdc: Boolean
    $lgs: Boolean
  ) {
    updateAltairInstrument(
      pk: $pk
      beamsplitter: $beamsplitter
      startMagnitude: $startMagnitude
      seeing: $seeing
      windSpeed: $windSpeed
      forceMode: $forceMode
      ndFilter: $ndFilter
      fieldLens: $fieldLens
      deployAdc: $deployAdc
      adjustAdc: $adjustAdc
      lgs: $lgs
    ) {
      ...AltairInstrumentItem
    }
  }
`);

export function useUpdateAltairInstrument() {
  const altairInstrument = useAltairInstrument().data?.altairInstrument;
  return useMutation(UPDATE_ALTAIR_INSTRUMENT, {
    context: { clientName: 'navigateConfigs' },
    optimisticResponse: (vars, { IGNORE }) =>
      altairInstrument
        ? {
            updateAltairInstrument: {
              ...altairInstrument,
              ...vars,
            } as typeof altairInstrument,
          }
        : IGNORE,
  });
}
