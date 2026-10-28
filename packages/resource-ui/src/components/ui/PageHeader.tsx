/** Five destinations share three decisions; a copy per page is five chances for one to drift. */
import type { JSX, ReactNode } from 'react';

interface PageHeaderProps {
  readonly title: string;
  /** The page's own controls - a night stepper, a semester picker - pushed right. */
  readonly actions?: ReactNode;
}

export function PageHeader({ title, actions }: PageHeaderProps): JSX.Element {
  return (
    <header className="mb-4 flex flex-wrap items-end gap-4">
      <h1 className="text-base font-semibold text-foreground">{title}</h1>
      {actions !== undefined && <div className="ml-auto flex items-end gap-3">{actions}</div>}
    </header>
  );
}
