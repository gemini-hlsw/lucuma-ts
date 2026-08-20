/**
 * One labelled control in a finder's filter bar: the caption above its field.
 *
 * The binding between the two is `LabelledControl`, which the masthead uses as
 * well - this is the filter bar's layout over it, so the two places cannot
 * label a dropdown differently while looking different.
 */
import type { JSX, ReactNode } from 'react';

import { LabelledControl } from './LabelledControl';

export function FilterField({ label, children }: { label: string; children: (id: string) => ReactNode }): JSX.Element {
  return (
    <LabelledControl label={label} className="flex flex-col gap-1 text-xs text-foreground-secondary">
      {children}
    </LabelledControl>
  );
}
