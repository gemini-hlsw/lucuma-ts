/** Five destinations share four decisions; a copy per page is five chances for one to drift. */
import type { JSX, ReactNode } from 'react';

import { SyntheticDataTag } from './SyntheticDataTag';

interface PageHeaderProps {
  readonly title: string;
  /** True when the schedule behind this page was never published. */
  readonly demo?: boolean;
  /** The line under the title: what the page shows, in its own words. */
  readonly children?: ReactNode;
  /** The page's own controls - a night stepper, a view toggle - pushed right. */
  readonly actions?: ReactNode;
}

export function PageHeader({ title, demo = false, children, actions }: PageHeaderProps): JSX.Element {
  return (
    <header className="mb-4 flex flex-wrap items-end gap-4">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold text-foreground">{title}</h1>
          {demo && <SyntheticDataTag />}
        </div>
        {children !== undefined && <p className="mt-1 text-xs text-foreground-muted">{children}</p>}
      </div>
      {actions !== undefined && <div className="ml-auto flex items-end gap-3">{actions}</div>}
    </header>
  );
}
