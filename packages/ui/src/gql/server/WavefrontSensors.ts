import { useMutation } from '@apollo/client/react';
import type { Dispatch } from 'react';

import { graphql } from './gen';

export const OIWFS_OBSERVE = graphql(`
  mutation OiwfsObserve($period: TimeSpanInput!) {
    oiwfsObserve(period: $period) {
      result
      msg
    }
  }
`);

export function useOiwfsObserve(setStale: Dispatch<boolean>) {
  return useMutation(OIWFS_OBSERVE, {
    onCompleted: () => setStale(true),
  });
}

const OIWFS_STOP_OBSERVE = graphql(`
  mutation OiwfsStopObserve {
    oiwfsStopObserve {
      result
      msg
    }
  }
`);

export function useOiwfsStopObserve(setStale: Dispatch<boolean>) {
  return useMutation(OIWFS_STOP_OBSERVE, {
    onCompleted: () => setStale(true),
  });
}

export const PWFS1_OBSERVE = graphql(`
  mutation Pwfs1Observe($period: TimeSpanInput!) {
    pwfs1Observe(period: $period) {
      result
      msg
    }
  }
`);

export function usePwfs1Observe(setStale: Dispatch<boolean>) {
  return useMutation(PWFS1_OBSERVE, {
    onCompleted: () => setStale(true),
  });
}

const PWFS1_STOP_OBSERVE = graphql(`
  mutation Pwfs1StopObserve {
    pwfs1StopObserve {
      result
      msg
    }
  }
`);

export function usePwfs1StopObserve(setStale: Dispatch<boolean>) {
  return useMutation(PWFS1_STOP_OBSERVE, {
    onCompleted: () => setStale(true),
  });
}

const PWFS2_OBSERVE = graphql(`
  mutation Pwfs2Observe($period: TimeSpanInput!) {
    pwfs2Observe(period: $period) {
      result
      msg
    }
  }
`);

export function usePwfs2Observe(setStale: Dispatch<boolean>) {
  return useMutation(PWFS2_OBSERVE, {
    onCompleted: () => setStale(true),
  });
}

const PWFS2_STOP_OBSERVE = graphql(`
  mutation Pwfs2StopObserve {
    pwfs2StopObserve {
      result
      msg
    }
  }
`);

export function usePwfs2StopObserve(setStale: Dispatch<boolean>) {
  return useMutation(PWFS2_STOP_OBSERVE, {
    onCompleted: () => setStale(true),
  });
}

const AC_OBSERVE = graphql(`
  mutation AcObserve($period: TimeSpanInput!) {
    acObserve(period: $period) {
      result
      msg
    }
  }
`);

export function useAcObserve(setStale: Dispatch<boolean>) {
  return useMutation(AC_OBSERVE, {
    onCompleted: () => setStale(true),
  });
}

const AC_STOP_OBSERVE = graphql(`
  mutation AcStopObserve {
    acStopObserve {
      result
      msg
    }
  }
`);

export function useAcStopObserve(setStale: Dispatch<boolean>) {
  return useMutation(AC_STOP_OBSERVE, {
    onCompleted: () => setStale(true),
  });
}

export const PWFS1_QL_MODE = graphql(`
  mutation SetPwfs1QlMode($mode: QlMode) {
    pwfs1QlMode(mode: $mode) {
      result
      msg
    }
  }
`);

export function usePwfs1QlMode(setStale?: Dispatch<boolean>) {
  return useMutation(PWFS1_QL_MODE, {
    onCompleted: () => setStale?.(true),
  });
}

export const PWFS2_QL_MODE = graphql(`
  mutation SetPwfs2QlMode($mode: QlMode) {
    pwfs2QlMode(mode: $mode) {
      result
      msg
    }
  }
`);

export function usePwfs2QlMode(setStale?: Dispatch<boolean>) {
  return useMutation(PWFS2_QL_MODE, {
    onCompleted: () => setStale?.(true),
  });
}

export const OIWFS_QL_MODE = graphql(`
  mutation SetOiwfsQlMode($mode: QlMode) {
    oiwfsQlMode(mode: $mode) {
      result
      msg
    }
  }
`);

export function useOiwfsQlMode(setStale?: Dispatch<boolean>) {
  return useMutation(OIWFS_QL_MODE, {
    onCompleted: () => setStale?.(true),
  });
}

export type QlModeResult = ReturnType<typeof useOiwfsQlMode | typeof usePwfs1QlMode | typeof usePwfs2QlMode>;

export type ObserveResult = ReturnType<
  typeof useOiwfsObserve | typeof usePwfs1Observe | typeof usePwfs2Observe | typeof useAcObserve
>;
export type StopObserveResult = ReturnType<
  typeof useOiwfsStopObserve | typeof usePwfs1StopObserve | typeof usePwfs2StopObserve | typeof useAcStopObserve
>;

export const TAKE_SKY = graphql(`
  mutation WfsSky($period: TimeSpanInput!, $wfs: GuideProbe!) {
    wfsSky(period: $period, wfs: $wfs) {
      result
      msg
    }
  }
`);

export function useTakeSky() {
  return useMutation(TAKE_SKY);
}
