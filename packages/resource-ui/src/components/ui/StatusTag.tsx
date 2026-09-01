import { cn, when } from '@gemini-hlsw/lucuma-common-ui';
import { Tag, type TagProps } from 'primereact/tag';
import type { JSX } from 'react';

/** How loudly a status reads as plain words. Red is reserved, as everywhere. */
export type StatusTone = 'normal' | 'muted' | 'alert';

/** Both facets at once, so a piece cannot read "Spare" in the row and "Unavailable" in the record below. */
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
