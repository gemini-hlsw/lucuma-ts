import type { JSX, ReactNode } from 'react';

import { useSessionStatus } from '@/components/atoms/auth';
import type { EnvBannerProps } from '@/components/layout/EnvBanner';

import { SessionGate } from './SessionGate';
import { SplashContainer } from './SplashContainer';

export interface SessionGateContainerProps extends EnvBannerProps {
  readonly children: ReactNode;
}

export function SessionGateContainer({ children, ...banner }: SessionGateContainerProps): JSX.Element {
  const { status } = useSessionStatus();

  return (
    <SessionGate status={status} splash={<SplashContainer />} {...banner}>
      {children}
    </SessionGate>
  );
}
