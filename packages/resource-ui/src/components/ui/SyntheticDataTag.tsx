/** The picker's "(demo)" does not survive a screenshot; this sits beside the title. */
import { Tag } from 'primereact/tag';
import type { JSX } from 'react';

export function SyntheticDataTag(): JSX.Element {
  return (
    <Tag
      value="SYNTHETIC DATA"
      severity="warning"
      className="shrink-0 tracking-wider"
      data-testid="synthetic-data-tag"
    />
  );
}
