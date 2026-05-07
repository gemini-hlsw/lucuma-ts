import { useMutation } from '@apollo/client/react';
import { useQueryAndSubscription } from '@gql/use-query-and-subscription';

import { graphql } from './gen';

export const AC_MECHS_FRAGMENT = graphql(`
  fragment AcMechsItem on AcMechs {
    lens
    filter
    ndFilter
  }
`);

export const AC_MECHS_STATE = graphql(`
  query acMechsState {
    acMechsState {
      ...AcMechsItem
    }
  }
`);

export const AC_MECHS_STATE_SUB = graphql(`
  subscription acMechsStateSub {
    acMechsState {
      ...AcMechsItem
    }
  }
`);

export function useAcMechsState() {
  return useQueryAndSubscription(AC_MECHS_STATE, AC_MECHS_STATE_SUB, 'acMechsState', { useStale: false });
}

export const AC_LENS = graphql(`
  mutation acLens($lens: AcLens!) {
    acLens(lens: $lens) {
      result
      msg
    }
  }
`);

export function useAcLens() {
  return useMutation(AC_LENS);
}

export const AC_FILTER = graphql(`
  mutation acFilter($filter: AcFilter!) {
    acFilter(filter: $filter) {
      result
      msg
    }
  }
`);

export function useAcFilter() {
  return useMutation(AC_FILTER);
}

export const AC_ND_FILTER = graphql(`
  mutation acNdFilter($ndFilter: AcNdFilter!) {
    acNdFilter(ndFilter: $ndFilter) {
      result
      msg
    }
  }
`);

export function useAcNdFilter() {
  return useMutation(AC_ND_FILTER);
}

export const AC_WINDOW_SIZE = graphql(`
  mutation acWindowSize($size: AcWindowInput!) {
    acWindowSize(size: $size) {
      result
      msg
    }
  }
`);

export function useAcWindowSize() {
  return useMutation(AC_WINDOW_SIZE);
}

export const PWFS_MECHS_STATE_FRAGMENT = graphql(`
  fragment PwfsMechsStateItem on PwfsMechsState {
    filter
    fieldStop
  }
`);

export const PWFS1_MECHS_STATE = graphql(`
  query pwfs1MechsState {
    pwfs1MechsState {
      ...PwfsMechsStateItem
    }
  }
`);

export const PWFS1_MECHS_STATE_SUB = graphql(`
  subscription pwfs1MechsStateSub {
    pwfs1MechsState {
      ...PwfsMechsStateItem
    }
  }
`);

export function usePwfs1MechsState() {
  return useQueryAndSubscription(PWFS1_MECHS_STATE, PWFS1_MECHS_STATE_SUB, 'pwfs1MechsState', { useStale: false });
}

export const PWFS2_MECHS_STATE = graphql(`
  query pwfs2MechsState {
    pwfs2MechsState {
      ...PwfsMechsStateItem
    }
  }
`);

export const PWFS2_MECHS_STATE_SUB = graphql(`
  subscription pwfs2MechsStateSub {
    pwfs2MechsState {
      ...PwfsMechsStateItem
    }
  }
`);

export function usePwfs2MechsState() {
  return useQueryAndSubscription(PWFS2_MECHS_STATE, PWFS2_MECHS_STATE_SUB, 'pwfs2MechsState');
}

export type PwfsMechsStateResult = ReturnType<typeof usePwfs1MechsState | typeof usePwfs2MechsState>;

export const PWFS1_FILTER = graphql(`
  mutation pwfs1Filter($filter: PwfsFilter!) {
    pwfs1Filter(filter: $filter) {
      result
      msg
    }
  }
`);

export function usePwfs1Filter() {
  return useMutation(PWFS1_FILTER);
}

export const PWFS2_FILTER = graphql(`
  mutation pwfs2Filter($filter: PwfsFilter!) {
    pwfs2Filter(filter: $filter) {
      result
      msg
    }
  }
`);

export type PwfsFilterResult = ReturnType<typeof usePwfs1Filter | typeof usePwfs2Filter>;

export function usePwfs2Filter() {
  return useMutation(PWFS2_FILTER);
}

export const PWFS1_FIELD_STOP = graphql(`
  mutation pwfs1FieldStop($fieldStop: PwfsFieldStop!) {
    pwfs1FieldStop(fieldStop: $fieldStop) {
      result
      msg
    }
  }
`);

export function usePwfs1FieldStop() {
  return useMutation(PWFS1_FIELD_STOP);
}

export const PWFS2_FIELD_STOP = graphql(`
  mutation pwfs2FieldStop($fieldStop: PwfsFieldStop!) {
    pwfs2FieldStop(fieldStop: $fieldStop) {
      result
      msg
    }
  }
`);

export function usePwfs2FieldStop() {
  return useMutation(PWFS2_FIELD_STOP);
}

export type PwfsFieldStopResult = ReturnType<typeof usePwfs1FieldStop | typeof usePwfs2FieldStop>;
