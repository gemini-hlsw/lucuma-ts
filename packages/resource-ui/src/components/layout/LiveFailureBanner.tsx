/** One backend, so the banner states the situation and offers no action: nowhere else to send them. */
import type { JSX } from 'react';

import { useLiveFailure } from '@/gql/liveStatus';

export function LiveFailureBanner(): JSX.Element | null {
  const failure = useLiveFailure();
  if (failure === null) {
    return null;
  }
  return (
    <div
      role="alert"
      data-testid="live-failure-banner"
      className="flex flex-wrap items-center gap-3 border-b border-amber-600/60 bg-amber-900/30 px-4 py-2 text-sm text-amber-100"
    >
      <span className="min-w-0 flex-1">{failure}</span>
    </div>
  );
}
