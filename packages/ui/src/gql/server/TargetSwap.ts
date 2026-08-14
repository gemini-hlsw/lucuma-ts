import { useMutation } from '@apollo/client/react';
import type { Dispatch } from 'react';

import { graphql } from './gen';

export const SWAP_TARGET_MUTATION = graphql(`
  mutation SwapTarget($swapConfig: SwapConfigInput!) {
    swapTarget(swapConfig: $swapConfig) {
      result
      msg
    }
  }
`);
export const RESTORE_TARGET_MUTATION = graphql(`
  mutation RestoreTarget($config: TcsConfigInput!) {
    restoreTarget(config: $config) {
      result
      msg
    }
  }
`);

export function useSwapTarget(setStale: Dispatch<boolean>) {
  return useMutation(SWAP_TARGET_MUTATION, {
    onCompleted: () => setStale(true),
  });
}

export function useRestoreTarget(setStale: Dispatch<boolean>) {
  return useMutation(RESTORE_TARGET_MUTATION, {
    onCompleted: () => setStale(true),
  });
}
