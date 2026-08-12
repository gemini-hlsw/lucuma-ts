/**
 * The table a finder row opens into.
 *
 * Both browsers answer the same shape of question when a row is expanded - what
 * did this subject's records say, one line per record - so they draw it
 * identically: named columns over a dense table, rather than the ragged list
 * this replaced, where a reader had to infer from position that "Summit lab"
 * was a place and "Science" a status.
 *
 * A plain `<table>`, not a nested DataTable: this is presentation, not a
 * control, and PrimeReact's header fill, stripes and hover would compete with
 * the table it hangs inside instead of reading as one of its rows. The smaller
 * type and the hairline rules are what say "subordinate"; the full width and
 * the shared column set are what let a reader run their eye straight down from
 * the row above.
 *
 * **Status is words, not badges** (Dan, 2026-08-12). A tag per line turned a
 * ten-run history into a column of shouting pills; the state row above is where
 * a badge earns its ink, because there is one of it. Here the words carry the
 * status and colour only marks the one state worth noticing - red for a piece
 * or instrument that is out of service, the same red the schedule reserves for
 * a closure.
 *
 * **The columns never move.** A column that appears only when some record in
 * the window carries a note makes two expansions on one page disagree about
 * what the third column means. An empty cell is the honest answer, and it costs
 * nothing to read.
 *
 * Each page maps its own records onto `HistoryRow` and keeps its own
 * vocabulary - the component browser's "Spare", the instrument browser's
 * "Engineering use" - because the words belong to the page's subject, while the
 * shape belongs here.
 */
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

export interface RecordHistoryTableProps {
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
    // `pl-12` is the expander column's 2.5rem plus a body cell's 0.5rem of
    // padding, so the first cell starts exactly under the name of the thing it
    // belongs to and the records read as hanging off that row rather than off
    // the table edge. In rem, so it holds when the density root font size
    // changes. It still runs to the row's right edge, so the columns keep their
    // places as the window narrows and the note - the one that can run long -
    // takes whatever width is left. Narrower than the fixed columns need, the
    // table scrolls inside itself rather than pushing the page wide.
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
