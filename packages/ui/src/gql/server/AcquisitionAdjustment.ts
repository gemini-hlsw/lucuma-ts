import { useMutation, useSubscription } from '@apollo/client/react';

import { graphql } from './gen';

export const ACQUISITION_ADJUSTMENT_STATE_FRAGMENT = graphql(`
  fragment AcquisitionAdjustmentStateItem on AcquisitionAdjustmentState {
    offset {
      p {
        arcseconds
      }
      q {
        arcseconds
      }
    }
    ipa {
      degrees
    }
    iaa {
      degrees
    }
    command
  }
`);

const ACQUISITION_ADJUSTMENT_STATE_SUBSCRIPTION = graphql(`
  subscription AcquisitionAdjustmentState {
    acquisitionAdjustmentState {
      ...AcquisitionAdjustmentStateItem
    }
  }
`);

export function useAcquisitionAdjustmentState() {
  return useSubscription(ACQUISITION_ADJUSTMENT_STATE_SUBSCRIPTION);
}

const ACQUISITION_ADJUSTMENT = graphql(`
  mutation AcquisitionAdjustment($input: AcquisitionAdjustmentInput!) {
    acquisitionAdjustment(adjustment: $input) {
      result
      msg
    }
  }
`);

export function useAcquisitionAdjustment() {
  return useMutation(ACQUISITION_ADJUSTMENT);
}
