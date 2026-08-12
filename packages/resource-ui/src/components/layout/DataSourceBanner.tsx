/**
 * The way back when the live server fails.
 *
 * The pages already show their own "could not load" banners, but their text is
 * whatever the transport said. This one explains the situation in words a
 * tester can act on - the live service does not serve the v1 API yet - and
 * carries the one action that fixes it. Shown only on the live source; the
 * demo cannot fail this way.
 */
import { Button } from 'primereact/button';
import type { JSX } from 'react';

import { readDataSource, switchDataSource, useLiveFailure } from '@/gql/dataSource';

export function DataSourceBanner(): JSX.Element | null {
  const failure = useLiveFailure();
  if (failure === null || readDataSource() !== 'LIVE') {
    return null;
  }
  return (
    <div
      role="alert"
      data-testid="data-source-banner"
      className="flex flex-wrap items-center gap-3 border-b border-amber-600/60 bg-amber-900/30 px-4 py-2 text-sm text-amber-100"
    >
      <span className="min-w-0 flex-1">
        {failure} The built-in demo data serves the operations workbook&rsquo;s schedules in the meantime.
      </span>
      <Button
        size="small"
        severity="secondary"
        onClick={() => {
          switchDataSource('DEMO');
        }}
      >
        Use demo data
      </Button>
    </div>
  );
}
