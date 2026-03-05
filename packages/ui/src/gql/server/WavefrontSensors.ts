import { useMutation } from '@apollo/client/react';
import type { Dispatch } from 'react';

import { graphql } from './gen';

export const OIWFS_OBSERVE = graphql(`
  mutation oiwfsObserve($period: TimeSpanInput!) {
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
  mutation oiwfsStopObserve {
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
  mutation pwfs1Observe($period: TimeSpanInput!) {
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
  mutation pwfs1StopObserve {
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
  mutation pwfs2Observe($period: TimeSpanInput!) {
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
  mutation pwfs2StopObserve {
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
  mutation acObserve($period: TimeSpanInput!) {
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
  mutation acStopObserve {
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

export type ObserveResult = ReturnType<
  typeof useOiwfsObserve | typeof usePwfs1Observe | typeof usePwfs2Observe | typeof useAcObserve
>;
export type StopObserveResult = ReturnType<
  typeof useOiwfsStopObserve | typeof usePwfs1StopObserve | typeof usePwfs2StopObserve | typeof useAcStopObserve
>;

export const TAKE_SKY = graphql(`
  mutation wfsSky($period: TimeSpanInput!, $wfs: GuideProbe!) {
    wfsSky(period: $period, wfs: $wfs) {
      result
      msg
    }
  }
`);

export function useTakeSky() {
  return useMutation(TAKE_SKY);
}
