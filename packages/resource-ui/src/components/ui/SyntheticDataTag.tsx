/**
 * The amber flag a synthetic schedule wears on the page itself.
 *
 * The pickers already say "(demo)" and the title says "synthetic demo", but a
 * screenshot carries neither reliably: the tag sits in the page header beside
 * the title, so a capture of a demo semester can never pass as a published
 * schedule. Shown wherever the data on the page comes from a schedule the API
 * marks `demo: true`.
 */
import { Tag } from 'primereact/tag';
import type { JSX } from 'react';

export function SyntheticDataTag(): JSX.Element {
  return (
    <Tag
      value="SYNTHETIC DATA"
      severity="warning"
      className="shrink-0 !text-[0.6rem] tracking-wide"
      data-testid="synthetic-data-tag"
    />
  );
}
