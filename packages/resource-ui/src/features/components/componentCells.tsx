import { when } from '@gemini-hlsw/lucuma-common-ui';
import type { JSX } from 'react';

import { StatusTag } from '@/components/ui/StatusTag';
import type { FinderRow } from '@/domain/componentFinder';

import { componentStatus } from './componentLabels';

export function ComponentIdentityCell({ row }: { row: FinderRow }): JSX.Element {
  return (
    <span className="flex flex-col">
      <span className="font-medium text-foreground">{row.component.name}</span>
      <span className="text-xs text-foreground-secondary">
        {row.component.code}
        {when(row.component.barcode, (barcode) => ` · barcode ${barcode}`)}
      </span>
    </span>
  );
}

/** The badge alone: the record's note is its own column (`NoteCell`), never a second line here. */
export function StatusCell({ row }: { row: FinderRow }): JSX.Element | null {
  const status = componentStatus(row.usage, row.where.kind === 'STORED', row.note);
  return status === null ? null : <StatusTag status={status} />;
}
