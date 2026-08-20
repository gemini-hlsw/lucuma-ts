/**
 * The published semester schedule, drawn as one xrange chart per month.
 *
 * Small multiples rather than one continuous axis, because the sheet's month
 * rhythm is where its readability comes from and matching it keeps the
 * cell-for-cell comparison honest. Each month is its own chart, so each one fills
 * the width it is given: the charts sit in an auto-fitting grid that shows one
 * month per row on a narrow window and two side by side on a wide one, and
 * Highcharts reflows each chart to its container. The old table could not do this
 * at all - its columns were a fixed 1.5rem, so the grid was the same size on a
 * phone and on a 4K display.
 */
import type { JSX } from 'react';

import { useOpenNight } from '@/app/useOpenNight';
import type { SemesterTimeline as Timeline, TimelineMonth } from '@/domain/semesterTimeline';
import { nightAt } from '@/domain/timeline';
import type { Site } from '@/domain/types';
import { TimelineChart } from '@/features/timeline/TimelineChart';

import { buildSemesterMonthOptions } from './semesterMonthOptions';

export { TimelineLegendBar as SemesterTimelineLegend } from '@/features/timeline/TimelineChart';

function MonthChart({ month, site, now }: { month: TimelineMonth; site: Site; now: number | null }): JSX.Element {
  const options = buildSemesterMonthOptions({ month, site, now });

  // A click anywhere on the month - a bar or the space around it - opens the
  // night under the cursor, the same jump the calendar squares make.
  const openNight = useOpenNight();
  const openNightAt = (instant: number): void => {
    const night = nightAt(month.nights, instant);
    if (night !== null) {
      openNight(night.observingNight);
    }
  };

  return (
    <TimelineChart
      options={options}
      continuesLabel="continues past this month"
      label={month.label}
      testId={`semester-month-${month.label}`}
      onInstantClick={openNightAt}
      heading={
        <h3 className="mb-1 text-xs font-semibold tracking-wide text-foreground-secondary uppercase">{month.label}</h3>
      }
    />
  );
}

export function SemesterTimeline({
  timeline,
  site,
  now,
}: {
  timeline: Timeline;
  site: Site;
  now: number | null;
}): JSX.Element {
  return (
    <div
      data-testid="semester-timeline"
      // auto-fit rather than a breakpoint: the shell's sidebar takes width the
      // viewport query cannot see, so the grid reacts to the space it actually has.
      className="grid [grid-template-columns:repeat(auto-fit,minmax(min(30rem,100%),1fr))] gap-x-8 gap-y-5"
    >
      {timeline.months.map((month) => (
        <MonthChart key={`${month.year}-${month.month}`} month={month} site={site} now={now} />
      ))}
    </div>
  );
}
