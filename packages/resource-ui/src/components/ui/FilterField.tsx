/**
 * One labelled control in a finder's filter bar.
 *
 * A real `<label>` wrapping its control, so the caption is the control's name
 * to assistive readers and clicking it focuses the field - which is why this is
 * a wrapper rather than a class string the pages repeat.
 */
import type { JSX, ReactNode } from 'react';

export function FilterField({ label, children }: { label: string; children: ReactNode }): JSX.Element {
  return (
    <label className="flex flex-col gap-1 text-xs text-foreground-secondary">
      {label}
      {children}
    </label>
  );
}
