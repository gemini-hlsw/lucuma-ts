import { useMutation } from '@apollo/client/react';
import { useQueryAndSubscription } from '@gql/use-query-and-subscription';
import type { Dispatch } from 'react';

import { graphql } from './gen';

export const NAVIGATE_STATE_FRAGMENT = graphql(`
  fragment NavigateStateItem on NavigateState {
    onSwappedTarget
  }
`);

export const NAVIGATE_STATE = graphql(`
  query getNavigateState {
    navigateState {
      ...NavigateStateItem
    }
  }
`);

export const NAVIGATE_STATE_SUBSCRIPTION = graphql(`
  subscription navigateStates {
    navigateState {
      ...NavigateStateItem
    }
  }
`);

export function useNavigateState() {
  return useQueryAndSubscription(NAVIGATE_STATE, NAVIGATE_STATE_SUBSCRIPTION, 'navigateState');
}

export const WFS_CONFIG_STATE_FRAGMENT = graphql(`
  fragment WfsConfigStateItem on WfsConfigState {
    saving
  }
`);

export const OIWFS_CONFIG_STATE = graphql(`
  query oiwfsConfigState {
    oiwfsConfigState {
      ...WfsConfigStateItem
    }
  }
`);

export const OIWFS_CONFIG_STATE_SUBSCRIPTION = graphql(`
  subscription oiwfsConfigStateSub {
    oiwfsConfigState {
      ...WfsConfigStateItem
    }
  }
`);

export function useOiwfsConfigState() {
  return useQueryAndSubscription(OIWFS_CONFIG_STATE, OIWFS_CONFIG_STATE_SUBSCRIPTION, 'oiwfsConfigState');
}

const OIWFS_CIRCULAR_BUFFER = graphql(`
  mutation setOiwfsCircularBuffer($enabled: Boolean!) {
    oiwfsCircularBuffer(enable: $enabled) {
      result
      msg
    }
  }
`);

export function useSetOiwfsCircularBuffer(setStale: Dispatch<boolean>) {
  return useMutation(OIWFS_CIRCULAR_BUFFER, {
    onCompleted: () => setStale(true),
  });
}

export const PWFS1_CONFIG_STATE = graphql(`
  query pwfs1ConfigState {
    pwfs1ConfigState {
      ...WfsConfigStateItem
    }
  }
`);

export const PWFS1_CONFIG_STATE_SUBSCRIPTION = graphql(`
  subscription pwfs1ConfigStateSub {
    pwfs1ConfigState {
      ...WfsConfigStateItem
    }
  }
`);

export function usePwfs1ConfigState() {
  return useQueryAndSubscription(PWFS1_CONFIG_STATE, PWFS1_CONFIG_STATE_SUBSCRIPTION, 'pwfs1ConfigState');
}

const PWFS1_CIRCULAR_BUFFER = graphql(`
  mutation setPwfs1CircularBuffer($enabled: Boolean!) {
    pwfs1CircularBuffer(enable: $enabled) {
      result
      msg
    }
  }
`);

export function useSetPwfs1CircularBuffer(setStale: Dispatch<boolean>) {
  return useMutation(PWFS1_CIRCULAR_BUFFER, {
    onCompleted: () => setStale(true),
  });
}

export const PWFS2_CONFIG_STATE = graphql(`
  query pwfs2ConfigState {
    pwfs2ConfigState {
      ...WfsConfigStateItem
    }
  }
`);

export const PWFS2_CONFIG_STATE_SUBSCRIPTION = graphql(`
  subscription pwfs2ConfigStateSub {
    pwfs2ConfigState {
      ...WfsConfigStateItem
    }
  }
`);

export function usePwfs2ConfigState() {
  return useQueryAndSubscription(PWFS2_CONFIG_STATE, PWFS2_CONFIG_STATE_SUBSCRIPTION, 'pwfs2ConfigState');
}

export const PWFS2_CIRCULAR_BUFFER = graphql(`
  mutation setPwfs2CircularBuffer($enabled: Boolean!) {
    pwfs2CircularBuffer(enable: $enabled) {
      result
      msg
    }
  }
`);

export function useSetPwfs2CircularBuffer(setStale: Dispatch<boolean>) {
  return useMutation(PWFS2_CIRCULAR_BUFFER, {
    onCompleted: () => setStale(true),
  });
}
