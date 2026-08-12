/**
 * The cells every component table shares.
 *
 * The browser and the night view answer the same question - where is this
 * piece, and is it usable - so they render it identically. A second copy of
 * `whereLabel` is how the grid and the chart came to disagree about closures;
 * this module exists so that cannot happen to components.
 */
import { cn, when } from '@gemini-hlsw/lucuma-common-ui';
import { Tag, type TagProps } from 'primereact/tag';
import type { JSX } from 'react';

import type { FinderRow } from '@/domain/componentFinder';

import { whereLabel } from './componentLabels';

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
 * The status vocabulary, derived from the record rather than echoing the enum.
 *
 * `ResourceUsage` says what a record means for the schedule, but a browser
 * reader asks a different question - is this piece working? A stored piece is
 * `UNAVAILABLE` for science by definition, and printing that in red made every
 * lab spare look broken. So: a stored piece with nothing wrong is a "Spare";
 * red is kept for a piece that is actually out of service, and the record's
 * note - "Failed; removed for repair" - rides under the tag, because a status
 * that cannot say why is not a status.
 */
interface Status {
  readonly label: string;
  readonly severity?: TagProps['severity'];
  /** A spare is unremarkable, so its tag is muted chrome, not a signal colour. */
  readonly muted?: boolean;
}

const statusOf = (row: FinderRow): Status | null => {
  switch (row.usage) {
    case null:
      return null;
    case 'SCIENCE':
      return { label: 'Science', severity: 'success' };
    case 'ENGINEERING':
      return { label: 'Engineering', severity: 'info' };
    default:
      return row.where.kind === 'STORED' && row.note === null
        ? { label: 'Spare', muted: true }
        : { label: 'Unavailable', severity: 'danger' };
  }
};

export function StatusCell({ row }: { row: FinderRow }): JSX.Element | null {
  const status = statusOf(row);
  if (status === null) {
    return null;
  }
  return (
    <span className="flex flex-col items-start gap-0.5">
      <Tag
        value={status.label}
        severity={status.severity}
        className={cn(
          '!text-[0.6rem]',
          when(status.muted, () => '!bg-surface-raised !text-foreground-secondary'),
        )}
      />
      {when(row.note, (note) => (
        <span className="text-[0.65rem] text-foreground-muted italic">{note}</span>
      ))}
    </span>
  );
}
