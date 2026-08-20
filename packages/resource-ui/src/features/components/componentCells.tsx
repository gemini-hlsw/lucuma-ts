/**
 * The cells every component table shares.
 *
 * The browser and the night view answer the same question - which piece is
 * this, where is it, and is it usable - so they render it identically. A second
 * copy of `whereLabel` is how the grid and the chart came to disagree about
 * closures; this module exists so that cannot happen to components.
 *
 * The Where cell itself is one level up (`components/ui/WhereCell`), shared with
 * the instrument browser: both finders answer "where is it" in the same three
 * shapes, and only the words differ. What stays here is what is specific to a
 * piece - its identity and its status.
 */
import { when } from '@gemini-hlsw/lucuma-common-ui';
import type { JSX } from 'react';

import { StatusTag } from '@/components/ui/StatusTag';
import type { FinderRow } from '@/domain/componentFinder';

import { componentStatus } from './componentLabels';

/**
 * Which piece this is: the name a reader knows it by, over the codes they will
 * be handed by ICTD or read off a barcode label.
 *
 * Both the browser and the night table print it, and identically - a piece
 * identified two ways on one page is a piece a reader has to check twice.
 */
export function ComponentIdentityCell({ row }: { row: FinderRow }): JSX.Element {
  return (
    <span className="flex flex-col">
      <span className="font-medium text-foreground">{row.component.name}</span>
      <span className="text-[0.65rem] text-foreground-muted">
        {row.component.code}
        {when(row.component.barcode, (barcode) => ` · barcode ${barcode}`)}
      </span>
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
