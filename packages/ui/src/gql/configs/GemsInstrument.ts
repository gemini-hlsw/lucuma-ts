import { useMutation, useQuery } from '@apollo/client/react';

import { graphql } from './gen';

export const GEMS_INSTRUMENT_FRAGMENT = graphql(`
  fragment GemsInstrumentItem on GemsInstrument {
    pk
    beamsplitter
    adc
    astrometricMode
  }
`);

const GET_GEMS_INSTRUMENT = graphql(`
  query GemsInstrument {
    gemsInstrument {
      ...GemsInstrumentItem
    }
  }
`);

export function useGemsInstrument() {
  return useQuery(GET_GEMS_INSTRUMENT, {
    context: { clientName: 'navigateConfigs' },
  });
}

const UPDATE_GEMS_INSTRUMENT = graphql(`
  mutation UpdateGemsInstrument($pk: PosInt!, $beamsplitter: String, $adc: Boolean, $astrometricMode: String) {
    updateGemsInstrument(pk: $pk, beamsplitter: $beamsplitter, adc: $adc, astrometricMode: $astrometricMode) {
      ...GemsInstrumentItem
    }
  }
`);

export function useUpdateGemsInstrument() {
  const gemsInstrument = useGemsInstrument().data?.gemsInstrument;
  return useMutation(UPDATE_GEMS_INSTRUMENT, {
    context: { clientName: 'navigateConfigs' },
    optimisticResponse: (vars, { IGNORE }) =>
      gemsInstrument
        ? {
            updateGemsInstrument: {
              ...gemsInstrument,
              ...vars,
            } as typeof gemsInstrument,
          }
        : IGNORE,
  });
}
