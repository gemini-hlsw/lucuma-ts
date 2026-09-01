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

  // A click anywhere on the month opens the night under the cursor, as a calendar square does.
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
      // auto-fit, not a breakpoint: the sidebar takes width a viewport query cannot see.
      className="grid [grid-template-columns:repeat(auto-fit,minmax(min(30rem,100%),1fr))] gap-x-8 gap-y-5"
    >
      {timeline.months.map((month) => (
        <MonthChart key={`${month.year}-${month.month}`} month={month} site={site} now={now} />
      ))}
    </div>
  );
}
