/**
 * The cells every component table shares.
 *
 * The browser and the night view answer the same question - where is this
 * piece, and is it usable - so they render it identically. A second copy of
 * `whereLabel` is how the grid and the chart came to disagree about closures;
 * this module exists so that cannot happen to components.
 */
import { cn } from '@gemini-hlsw/lucuma-common-ui';
import { Tag } from 'primereact/tag';
import type { JSX } from 'react';

import { StatusTag } from '@/components/ui/StatusTag';
import type { FinderRow } from '@/domain/componentFinder';

import { componentStatus, whereLabel } from './componentLabels';

export function WhereCell({
  row,
  changesTag = 'changes tonight',
}: {
  row: FinderRow;
  changesTag?: string;
}): JSX.Element {
  return (
    <span className="flex items-center gap-2">
      <span
        aria-hidden
        className={cn(
          'inline-block h-2 w-2 rounded-full',
          row.where.kind === 'INSTALLED'
            ? 'bg-gpp'
            : row.where.kind === 'STORED'
              ? 'border border-subtle bg-transparent'
              : 'bg-transparent',
        )}
      />
      <span className={row.where.kind === 'NOT_RECORDED' ? 'text-foreground-muted italic' : ''}>
        {whereLabel(row.where)}
      </span>
      {row.changesTonight && <Tag value={changesTag} severity="warning" className="!text-[0.6rem]" />}
    </span>
  );
}

/**
 * The status a row wears - the badge alone.
 *
 * The record's note used to ride under the badge, which made the status cell
 * two things at once and left the note unscannable: it started at a different x
 * on every row, and no column heading told the reader what it was (Dan,
 * 2026-08-12). It is a column now (`NoteCell`), on the browsers and the night
 * table alike.
 *
 * The vocabulary itself lives in `componentLabels.componentStatus`, shared with
 * the row's history so the two cannot answer the same record differently.
 */
export function StatusCell({ row }: { row: FinderRow }): JSX.Element | null {
  const status = componentStatus(row.usage, row.where.kind === 'STORED', row.note);
  return status === null ? null : <StatusTag status={status} />;
}
