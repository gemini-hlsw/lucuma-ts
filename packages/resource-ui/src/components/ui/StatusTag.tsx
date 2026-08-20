/**
 * The status one finder row wears, and the vocabulary behind it.
 *
 * A row gets a badge: there is one of it, it is the answer to the question the
 * page asks, and the colour is doing work. The record list a row opens into
 * gets the same words in plain text (`RecordHistoryTable`) - ten badges stacked
 * under one row is a column of shouting pills, and the reader is scanning dates
 * by then, not statuses.
 *
 * So a status carries both facets: the badge `severity` for the row, and the
 * `tone` for the words. One derivation, two renderings - which is what stops a
 * piece reading "Spare" in the row and "Unavailable" in the record under it.
 */
import { cn, when } from '@gemini-hlsw/lucuma-common-ui';
import { Tag, type TagProps } from 'primereact/tag';
import type { JSX } from 'react';

/** How loudly a status reads as plain words. Red is reserved, as everywhere. */
export type StatusTone = 'normal' | 'muted' | 'alert';

export interface RecordStatus {
  readonly label: string;
  /** The badge colour in a finder row. Absent means unremarkable chrome. */
  readonly severity?: TagProps['severity'];
  readonly tone: StatusTone;
}

export function StatusTag({ status }: { status: RecordStatus }): JSX.Element {
  return (
    <Tag
      value={status.label}
      severity={status.severity}
      className={cn(
        '!text-[0.6rem]',
        when(status.tone === 'muted', () => '!bg-surface-raised !text-foreground-secondary'),
      )}
    />
  );
}
