import { useMutation, useQuery } from '@apollo/client/react';

import { graphql } from './gen';

export const GEMS_GUIDE_LOOP_FRAGMENT = graphql(`
  fragment GemsGuideLoopItem on GemsGuideLoop {
    pk
    aoEnabled
    focus
    rotation
    tipTilt
    anisopl
    flexure
  }
`);

const GET_GEMS_GUIDE_LOOP = graphql(`
  query GemsGuideLoop {
    gemsGuideLoop {
      ...GemsGuideLoopItem
    }
  }
`);

export function useGetGemsGuideLoop() {
  return useQuery(GET_GEMS_GUIDE_LOOP, {
    context: { clientName: 'navigateConfigs' },
  });
}

const UPDATE_GEMS_GUIDE_LOOP = graphql(`
  mutation UpdateGemsGuideLoop(
    $pk: PosInt!
    $aoEnabled: Boolean
    $focus: Boolean
    $rotation: Boolean
    $tipTilt: Boolean
    $anisopl: Boolean
    $flexure: Boolean
  ) {
    updateGemsGuideLoop(
      pk: $pk
      aoEnabled: $aoEnabled
      focus: $focus
      rotation: $rotation
      tipTilt: $tipTilt
      anisopl: $anisopl
      flexure: $flexure
    ) {
      ...GemsGuideLoopItem
    }
  }
`);

export function useUpdateGemsGuideLoop() {
  const gemsGuideLoop = useGetGemsGuideLoop().data?.gemsGuideLoop;
  return useMutation(UPDATE_GEMS_GUIDE_LOOP, {
    context: { clientName: 'navigateConfigs' },
    optimisticResponse: (vars, { IGNORE }) =>
      gemsGuideLoop
        ? {
            updateGemsGuideLoop: {
              ...gemsGuideLoop,
              ...vars,
            } as typeof gemsGuideLoop,
          }
        : IGNORE,
  });
}
