/** The filter bar's layout over `LabelledControl`, which the masthead uses too. */
import type { JSX, ReactNode } from 'react';

import { LabelledControl } from './LabelledControl';

export function FilterField({ label, children }: { label: string; children: (id: string) => ReactNode }): JSX.Element {
  return (
    <LabelledControl
      label={label}
      // Shrinkable, or the column sits at max-content and a control's `max-w-full` clamps to its own width.
      className="flex min-w-0 flex-col gap-1 text-xs text-foreground-secondary"
      // On the caption alone, not the column: a dropdown value inherits the column and would flatten against it.
      labelClassName="font-semibold"
    >
      {children}
    </LabelledControl>
  );
}
