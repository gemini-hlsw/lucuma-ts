import type { JSX } from 'react';

import { useOpenNight } from '@/app/useOpenNight';
import { contains } from '@/domain/interval';
import { nightAt } from '@/domain/timeline';
import type { Site } from '@/domain/types';
import type { WeekTimeline as Timeline } from '@/domain/weekTimeline';
import { TimelineChart, TimelineLegendBar } from '@/features/timeline/TimelineChart';
import { calendarLegendExtras, type LegendExtra } from '@/features/timeline/timelineOptions';

import { buildWeekChartOptions } from './weekChartOptions';

/** Decides "Now" here, off a prop, so the page's week does not take `now` as a dependency. */
export function WeekTimelineLegend({
  week,
  now,
  telescope,
  mode,
  too,
}: {
  week: Timeline;
  now: number;
  telescope: readonly LegendExtra[];
  mode: readonly LegendExtra[];
  too: readonly LegendExtra[];
}): JSX.Element {
  return (
    <TimelineLegendBar
      legend={week}
      telescope={telescope}
      mode={mode}
      too={too}
      calendar={calendarLegendExtras({
        weekend: week.nights.some((night) => night.isWeekend),
        now: contains(week.interval, now) && 'Now',
        noData: week.nights.some((night) => !night.dataAvailable),
      })}
    />
  );
}

export function WeekTimeline({
  week,
  site,
  now,
  label,
}: {
  week: Timeline;
  site: Site;
  now: number;
  label: string;
}): JSX.Element {
  const options = buildWeekChartOptions({ week, site });

  const openNight = useOpenNight();
  const openNightAt = (instant: number): void => {
    const night = nightAt(week.nights, instant);
    if (night !== null) {
      openNight(night.observingNight);
    }
  };

  return (
    <TimelineChart
      options={options}
      now={now}
      continuesLabel="continues past this week"
      label={label}
      testId="week-timeline"
      onInstantClick={openNightAt}
    />
  );
}
