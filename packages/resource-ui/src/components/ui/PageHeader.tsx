/** Five destinations share three decisions; a copy per page is five chances for one to drift. */
import type { JSX, ReactNode } from 'react';

interface PageHeaderProps {
  readonly title: string;
  /** The line under the title: what the page shows, in its own words. */
  readonly children?: ReactNode;
  /** The page's own controls - a night stepper, a semester picker - pushed right. */
  readonly actions?: ReactNode;
}

export function PageHeader({ title, children, actions }: PageHeaderProps): JSX.Element {
  return (
    <header className="mb-4 flex flex-wrap items-end gap-4">
      <div>
        <h1 className="text-base font-semibold text-foreground">{title}</h1>
        {children !== undefined && <p className="mt-1 text-xs text-foreground-secondary">{children}</p>}
      </div>
      {actions !== undefined && <div className="ml-auto flex items-end gap-3">{actions}</div>}
    </header>
  );
}
