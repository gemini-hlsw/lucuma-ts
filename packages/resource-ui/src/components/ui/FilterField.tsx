/** The filter bar's layout over `LabelledControl`, which the masthead uses too. */
import type { JSX, ReactNode } from 'react';

import { LabelledControl } from './LabelledControl';

export function FilterField({ label, children }: { label: string; children: (id: string) => ReactNode }): JSX.Element {
  return (
    <LabelledControl label={label} className="flex flex-col gap-1 text-xs text-foreground-secondary">
      {children}
    </LabelledControl>
  );
}
