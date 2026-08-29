/**
 * The semester as rows of text: one per block, not one per night.
 *
 * Pure, and separate from the component that renders it, so it can be tested
 * without a browser - and because a run's extent phrased in the sheet's own
 * dates is exactly the kind of thing that should be pinned by a test rather than
 * eyeballed in a screen reader.
 */
import type { SemesterTimeline } from '@/domain/semesterTimeline';
import { eveningLabel, firstEveningDate, lastEveningDate } from '@/domain/siteTime';
import { nightsIn } from '@/domain/timeline';
import type { Interval, Site } from '@/domain/types';
import { UNSCHEDULED_LABEL } from '@/features/timeline/timelineOptions';

/**
 * A block's extent as two cells, in the evening dates the published sheet heads
 * its columns with, so a reader checking this against the sheet compares like
 * with like. Two columns rather than one range string: the table sorts and
 * scans by them.
 */
const extent = (interval: Interval, site: Site): { from: string; to: string } => ({
  from: eveningLabel(firstEveningDate(site, interval)),
  to: eveningLabel(lastEveningDate(site, interval)),
});

const nightCount = (nights: number): string => `${nights} ${nights === 1 ? 'night' : 'nights'}`;

interface BlockRow {
  readonly key: string;
  readonly rowLabel: string;
  readonly subject: string;
  readonly from: string;
  readonly to: string;
  readonly nights: string;
}

/** Filed under no port, because a closure of the whole telescope is not about one. */
export const WHOLE_TELESCOPE = 'Whole telescope';

export const buildBlockRows = (timeline: SemesterTimeline, site: Site): readonly BlockRow[] => [
  ...timeline.rows.flatMap((row) =>
    row.blocks.map((block) => ({
      key: block.id,
      rowLabel: row.label,
      subject: block.label === '' ? UNSCHEDULED_LABEL : block.label,
      ...extent(block.interval, site),
      nights: nightCount(block.nights),
    })),
  ),
  // Bands last and under no row. Spelling a telescope-wide phrase one word per
  // port is exactly what the superseded grid did, and why Port 2 read as though
  // it were named "Telescope".
  ...timeline.bands.map((band) => ({
    key: band.id,
    rowLabel: WHOLE_TELESCOPE,
    subject: band.label,
    ...extent(band.interval, site),
    nights: nightCount(nightsIn(band.interval)),
  })),
];
