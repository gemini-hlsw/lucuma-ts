/**
 * The block every destination opens with: what this page is, and its own
 * controls.
 *
 * Five pages had their own copy of the same four decisions - the title's
 * weight, where the synthetic flag sits, the muted line under it, and that the
 * controls are pushed right and bottom-aligned with the title. Five copies is
 * five chances for one page to drift a size, which reads to a user as landing
 * somewhere else in the app.
 *
 * The subtitle is `children` rather than a string because every page's is a
 * sentence with something live in it - a link back to the semester, a moon
 * fraction, a count.
 */
import type { JSX, ReactNode } from 'react';

import { SyntheticDataTag } from './SyntheticDataTag';

export interface PageHeaderProps {
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
