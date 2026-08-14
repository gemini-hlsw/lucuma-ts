import { useMutation, useQuery } from '@apollo/client/react';

import { graphql } from './gen';

export const ALTAIR_GUIDE_LOOP_FRAGMENT = graphql(`
  fragment AltairGuideLoopItem on AltairGuideLoop {
    pk
    aoEnabled
    oiBlend
    focus
    p1Ttf
    strap
    oiTtf
    ttgs
    sfo
  }
`);

const GET_ALTAIR_GUIDE_LOOP = graphql(`
  query AltairGuideLoop {
    altairGuideLoop {
      ...AltairGuideLoopItem
    }
  }
`);

export function useAltairGuideLoop() {
  return useQuery(GET_ALTAIR_GUIDE_LOOP, {
    context: { clientName: 'navigateConfigs' },
  });
}

const UPDATE_ALTAIR_GUIDE_LOOP = graphql(`
  mutation UpdateAltairGuideLoop(
    $pk: PosInt!
    $aoEnabled: Boolean
    $oiBlend: Boolean
    $focus: Boolean
    $p1Ttf: Boolean
    $strap: Boolean
    $oiTtf: Boolean
    $ttgs: Boolean
    $sfo: Boolean
  ) {
    updateAltairGuideLoop(
      pk: $pk
      aoEnabled: $aoEnabled
      oiBlend: $oiBlend
      focus: $focus
      p1Ttf: $p1Ttf
      strap: $strap
      oiTtf: $oiTtf
      ttgs: $ttgs
      sfo: $sfo
    ) {
      ...AltairGuideLoopItem
    }
  }
`);

export function useUpdateAltairGuideLoop() {
  const altairGuideLoop = useAltairGuideLoop().data?.altairGuideLoop;
  return useMutation(UPDATE_ALTAIR_GUIDE_LOOP, {
    context: { clientName: 'navigateConfigs' },
    optimisticResponse: (vars, { IGNORE }) =>
      altairGuideLoop
        ? {
            updateAltairGuideLoop: {
              ...altairGuideLoop,
              ...vars,
            } as typeof altairGuideLoop,
          }
        : IGNORE,
  });
}
