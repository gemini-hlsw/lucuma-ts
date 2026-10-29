import type { JSX } from 'react';

import { useOpenNight } from '@/app/useOpenNight';
import { contains } from '@/domain/interval';
import type { SemesterTimeline as Timeline, TimelineMonth } from '@/domain/semesterTimeline';
import { nightAt } from '@/domain/timeline';
import type { Site } from '@/domain/types';
import { TimelineChart, TimelineLegendBar } from '@/features/timeline/TimelineChart';
import { calendarLegendExtras, type LegendExtra } from '@/features/timeline/timelineOptions';

import { buildSemesterMonthOptions } from './semesterMonthOptions';

/** Decides "Today" here, off a prop, so the page's timeline does not take `now` as a dependency. */
export function SemesterTimelineLegend({
  timeline,
  now,
  telescope,
  mode,
  too,
}: {
  timeline: Timeline;
  now: number;
  telescope: readonly LegendExtra[];
  mode: readonly LegendExtra[];
  too: readonly LegendExtra[];
}): JSX.Element {
  const today = timeline.months.some((month) => month.nights.some((night) => contains(night.interval, now)));
  return (
    <TimelineLegendBar
      legend={timeline}
      telescope={telescope}
      mode={mode}
      too={too}
      calendar={calendarLegendExtras({ weekend: true, now: today && 'Today' })}
    />
  );
}

function MonthChart({ month, site, now }: { month: TimelineMonth; site: Site; now: number }): JSX.Element {
  const options = buildSemesterMonthOptions({ month, site });

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
      now={now}
      onInstantClick={openNightAt}
      heading={
        <h3 className="mb-1 text-xs font-semibold tracking-wider text-foreground-secondary uppercase">{month.label}</h3>
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
  now: number;
}): JSX.Element {
  return (
    <div
      data-testid="semester-timeline"
      // auto-fit, not a breakpoint: the sidebar takes width a viewport query cannot see.
      className="grid [grid-template-columns:repeat(auto-fit,minmax(min(420px,100%),1fr))] gap-x-8 gap-y-5"
    >
      {timeline.months.map((month) => (
        <MonthChart key={`${month.year}-${month.month}`} month={month} site={site} now={now} />
      ))}
    </div>
  );
}
