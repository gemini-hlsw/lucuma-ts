import type { JSX, ReactNode } from 'react';

import { PRODUCT_NAME } from '@/app/product';
import type { SessionStatus } from '@/components/atoms/auth';
import { EnvBanner, type EnvBannerProps } from '@/components/layout/EnvBanner';
import { Loading } from '@/components/ui/PageStatus';

export interface SessionGateProps extends EnvBannerProps {
  readonly status: SessionStatus;
  readonly splash: ReactNode;
  readonly children: ReactNode;
}

/** Nothing below the banner mounts until the session check settles, so no page ever loads signed out by mistake. */
export function SessionGate({ status, splash, children, ...banner }: SessionGateProps): JSX.Element {
  return (
    <div className="grid h-dvh grid-rows-[auto_minmax(0,1fr)] print:block print:h-auto">
      <div className="print:hidden">
        <EnvBanner {...banner} />
      </div>
      {gated(status, splash, children)}
    </div>
  );
}

function gated(status: SessionStatus, splash: ReactNode, children: ReactNode): ReactNode {
  switch (status) {
    case 'checking':
      return <Loading what={PRODUCT_NAME} />;
    case 'signed-out':
      return splash;
    case 'signed-in':
      return children;
  }
}
