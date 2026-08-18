/**
 * What the app says when the live server does not answer.
 *
 * The pages already show their own "could not load" banners, but their text is
 * whatever the transport said. This one explains the situation in words a
 * tester can act on: the live service does not serve the v1 API yet, which is
 * the expected state until the Scala backend ships.
 *
 * It carried a "Use demo data" button until 2026-08-14, back when the app could
 * be pointed at the in-browser mock. There is one backend now, so the banner
 * states the situation and stops - an action that only ever led somewhere else
 * to read is not an action.
 */
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
