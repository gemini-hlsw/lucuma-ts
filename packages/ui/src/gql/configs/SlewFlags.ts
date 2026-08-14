import { useMutation, useQuery } from '@apollo/client/react';

import { graphql } from './gen';

export const SLEW_FLAGS_FRAGMENT = graphql(`
  fragment SlewFlagsItem on SlewFlags {
    pk
    zeroChopThrow
    zeroSourceOffset
    zeroSourceDiffTrack
    zeroMountOffset
    zeroMountDiffTrack
    shortcircuitTargetFilter
    shortcircuitMountFilter
    resetPointing
    stopGuide
    zeroGuideOffset
    zeroInstrumentOffset
    autoparkPwfs1
    autoparkPwfs2
    autoparkOiwfs
    autoparkGems
    autoparkAowfs
  }
`);

export const GET_SLEW_FLAGS = graphql(`
  query SlewFlags {
    slewFlags {
      ...SlewFlagsItem
    }
  }
`);

export function useSlewFlags() {
  return useQuery(GET_SLEW_FLAGS, {
    context: { clientName: 'navigateConfigs' },
  });
}

const UPDATE_SLEW_FLAGS = graphql(`
  mutation UpdateSlewFlags(
    $pk: PosInt!
    $zeroChopThrow: Boolean
    $zeroSourceOffset: Boolean
    $zeroSourceDiffTrack: Boolean
    $zeroMountOffset: Boolean
    $zeroMountDiffTrack: Boolean
    $shortcircuitTargetFilter: Boolean
    $shortcircuitMountFilter: Boolean
    $resetPointing: Boolean
    $stopGuide: Boolean
    $zeroGuideOffset: Boolean
    $zeroInstrumentOffset: Boolean
    $autoparkPwfs1: Boolean
    $autoparkPwfs2: Boolean
    $autoparkOiwfs: Boolean
    $autoparkGems: Boolean
    $autoparkAowfs: Boolean
  ) {
    updateSlewFlags(
      pk: $pk
      zeroChopThrow: $zeroChopThrow
      zeroSourceOffset: $zeroSourceOffset
      zeroSourceDiffTrack: $zeroSourceDiffTrack
      zeroMountOffset: $zeroMountOffset
      zeroMountDiffTrack: $zeroMountDiffTrack
      shortcircuitTargetFilter: $shortcircuitTargetFilter
      shortcircuitMountFilter: $shortcircuitMountFilter
      resetPointing: $resetPointing
      stopGuide: $stopGuide
      zeroGuideOffset: $zeroGuideOffset
      zeroInstrumentOffset: $zeroInstrumentOffset
      autoparkPwfs1: $autoparkPwfs1
      autoparkPwfs2: $autoparkPwfs2
      autoparkOiwfs: $autoparkOiwfs
      autoparkGems: $autoparkGems
      autoparkAowfs: $autoparkAowfs
    ) {
      ...SlewFlagsItem
    }
  }
`);

export function useUpdateSlewFlags() {
  const slewFlags = useSlewFlags().data?.slewFlags;
  return useMutation(UPDATE_SLEW_FLAGS, {
    context: { clientName: 'navigateConfigs' },
    optimisticResponse: (vars, { IGNORE }) =>
      slewFlags
        ? {
            updateSlewFlags: {
              ...slewFlags,
              ...vars,
            } as typeof slewFlags,
          }
        : IGNORE,
  });
}
