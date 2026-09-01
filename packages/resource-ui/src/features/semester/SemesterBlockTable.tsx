import type { JSX } from 'react';

import type { SemesterTimeline } from '@/domain/semesterTimeline';
import type { Site } from '@/domain/types';

import { buildBlockRows } from './semesterBlockRows';

/** `sr-only` rather than `hidden`: hidden would take it out of the accessibility tree. */
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
