/**
 * The semester as text: one row per block, not one cell per night.
 *
 * ## Why this exists rather than a fourth tab
 *
 * All three views are pictures, so none of them is readable without sight. The
 * view this package used to ship called itself "the accessible reading" and was
 * a grid of one cell per night - about nine hundred of them for GS 2026B,
 * announcing "Port 3: GMOS, night of 7 Aug", then the 8th, then the 9th, for
 * every port, to convey sixteen facts. That is worse than no table at all.
 *
 * A block is the fact. "Port 3, GMOS, 7 Aug to 31 Jan, 178 nights" is one row,
 * and sixteen of them is the whole semester. So this renders beside whichever
 * view is showing rather than being something to switch to, and it takes no
 * space, because the sighted reader already has the picture.
 *
 * The rows are placed over the whole semester rather than per month, so a run
 * crossing a month boundary is one row - the same reason the import merged
 * GHOST on Port 1 into one block from August to January rather than six.
 */
import type { JSX } from 'react';

import type { SemesterTimeline } from '@/domain/semesterTimeline';
import type { Site } from '@/domain/types';

import { buildBlockRows } from './semesterBlockRows';

/**
 * `sr-only` rather than `hidden`: hidden would take it out of the accessibility
 * tree along with the layout, which is the one thing it is here for.
 */
export function SemesterBlockTable({
  timeline,
  site,
  caption,
}: {
  timeline: SemesterTimeline;
  site: Site;
  caption: string;
}): JSX.Element {
  const rows = buildBlockRows(timeline, site);

  return (
    <table className="sr-only" data-testid="semester-block-table">
      <caption>{caption}</caption>
      <thead>
        <tr>
          <th scope="col">Row</th>
          <th scope="col">Subject</th>
          <th scope="col">First night</th>
          <th scope="col">Last night</th>
          <th scope="col">Length</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key}>
            <th scope="row">{row.rowLabel}</th>
            <td>{row.subject}</td>
            <td>{row.from}</td>
            <td>{row.to}</td>
            <td>{row.nights}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
