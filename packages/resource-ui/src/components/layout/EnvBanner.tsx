import type { JSX } from 'react';

import { environmentLabel } from '@/app/environment';

/** A strip above the whole shell: a build that is not production must say so where nothing clips it. */
export function EnvBanner(): JSX.Element | null {
  const label = environmentLabel(window.location.hostname);

  return label === null ? null : (
    <div className="xp-env-banner" data-testid="env-banner">
      {label}
    </div>
  );
}
