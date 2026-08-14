import { useMutation, useQuery } from '@apollo/client/react';

import { graphql } from './gen';
import type { Site } from './gen/graphql';

export const CAL_PARAMS_FRAGMENT = graphql(`
  fragment CalParamsItem on CalParams {
    pk
    site
    acqCamX
    acqCamY
    baffleVisible
    baffleNearIR
    topShutterCurrentLimit
    bottomShutterCurrentLimit
    pwfs1CenterX
    pwfs1CenterY
    pwfs1CenterZ
    pwfs2CenterX
    pwfs2CenterY
    pwfs2CenterZ
    defocusEnabled
    gnirsSfoDefocus
    gmosSfoDefocus
    gnirsP1Defocus
    gmosP1Defocus
    gmosOiDefocus
    comment
    createdAt
  }
`);

export const CAL_PARAMS = graphql(`
  query CalParams($site: Site!) {
    calParams(site: $site) {
      ...CalParamsItem
    }
  }
`);

export function useCalParams(site: Site) {
  return useQuery(CAL_PARAMS, {
    variables: { site },
    context: { clientName: 'navigateConfigs' },
  });
}
const CREATE_CAL_PARAMS = graphql(`
  mutation CreateCalParams($input: CalParamsCreateInput!) {
    createCalParams(input: $input) {
      ...CalParamsItem
    }
  }
`);

export function useCreateCalParams() {
  return useMutation(CREATE_CAL_PARAMS, {
    context: { clientName: 'navigateConfigs' },
    refetchQueries: [CAL_PARAMS, CAL_PARAMS_HISTORY],
  });
}

const CAL_PARAMS_HISTORY = graphql(`
  query CalParamsHistory($site: Site!) {
    calParamsHistory(site: $site) {
      pk
      comment
      createdAt
    }
  }
`);

export function useCalParamsHistory(site: Site) {
  return useQuery(CAL_PARAMS_HISTORY, {
    variables: { site },
    context: { clientName: 'navigateConfigs' },
  });
}

const REVERT_CAL_PARAMS = graphql(`
  mutation RevertCalParams($pk: PosInt!, $comment: String) {
    revertCalParams(pk: $pk, comment: $comment) {
      ...CalParamsItem
    }
  }
`);

export function useRevertCalParams() {
  return useMutation(REVERT_CAL_PARAMS, {
    context: { clientName: 'navigateConfigs' },
    refetchQueries: [CAL_PARAMS, CAL_PARAMS_HISTORY],
    awaitRefetchQueries: true,
  });
}

const DELETE_CAL_PARAMS = graphql(`
  mutation DeleteCalParams($pk: PosInt!) {
    deleteCalParams(pk: $pk)
  }
`);

export function useDeleteCalParams() {
  return useMutation(DELETE_CAL_PARAMS, {
    context: { clientName: 'navigateConfigs' },
    refetchQueries: [CAL_PARAMS, CAL_PARAMS_HISTORY],
    awaitRefetchQueries: true,
  });
}
