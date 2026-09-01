import { cn } from '@gemini-hlsw/lucuma-common-ui';
import type { JSX } from 'react';

import type { RecordStatus, StatusTone } from './StatusTag';

export interface HistoryRow {
  readonly id: string;
  /** The evening dates the record spans, already phrased by the page. */
  readonly dates: string;
  /** How many observing nights that is - what "how long was it out" asks for. */
  readonly nights: number;
  /** Where the record puts its subject - a port, or a place. */
  readonly where: string;
  readonly status: RecordStatus;
  readonly note: string | null;
}

const TONE_CLASS = {
  normal: 'text-foreground',
  muted: 'text-foreground-muted',
  alert: 'text-red-300',
} satisfies Record<StatusTone, string>;

interface RecordHistoryTableProps {
  readonly rows: readonly HistoryRow[];
  /** What the third column is called - "Location" for a piece, "Where" for an instrument. */
  readonly whereHeader: string;
  /** Named for assistive readers, since the table has no visible caption. */
  readonly ariaLabel: string;
  readonly testId: string;
  /** What to say when the window holds no record at all. */
  readonly emptyMessage: string;
}

const HEAD_CELL = 'py-1 pr-4 text-left font-medium whitespace-nowrap last:pr-0';
const CELL = 'py-1 pr-4 align-baseline last:pr-0';

export function RecordHistoryTable({
  rows,
  whereHeader,
  ariaLabel,
  testId,
  emptyMessage,
}: RecordHistoryTableProps): JSX.Element {
  return (
    // `pl-12` clears the expander column, so the records hang off the row rather than the table edge.
    <div className="w-full overflow-x-auto pl-12" data-testid={testId}>
      <table className="w-full text-xs" aria-label={ariaLabel}>
        <thead>
          <tr className="border-b border-subtle text-[0.6rem] tracking-wide text-foreground-secondary uppercase">
            <th scope="col" className={HEAD_CELL}>
              Dates
            </th>
            <th scope="col" className={cn(HEAD_CELL, 'text-right')}>
              Nights
            </th>
            <th scope="col" className={HEAD_CELL}>
              {whereHeader}
            </th>
            <th scope="col" className={HEAD_CELL}>
              Status
            </th>
            {/* The note absorbs the slack and wraps into it - see `NoteCell`. */}
            <th scope="col" className={cn(HEAD_CELL, 'w-full min-w-48')}>
              Note
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-subtle/40">
          {rows.length === 0 ? (
            <tr>
              <td className={cn(CELL, 'text-foreground-muted italic')} colSpan={5}>
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.id}>
                <td className={cn(CELL, 'whitespace-nowrap text-foreground-secondary tabular-nums')}>{row.dates}</td>
                <td className={cn(CELL, 'text-right text-foreground-secondary tabular-nums')}>{row.nights}</td>
                <td className={cn(CELL, 'whitespace-nowrap')}>{row.where}</td>
                <td className={cn(CELL, 'whitespace-nowrap', TONE_CLASS[row.status.tone])}>{row.status.label}</td>
                <td className={cn(CELL, 'text-foreground-muted italic')}>{row.note}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
