import type { JSX } from 'react';

import { useOpenNight } from '@/app/useOpenNight';
import { nightAt } from '@/domain/timeline';
import type { Site } from '@/domain/types';
import type { WeekTimeline as Timeline } from '@/domain/weekTimeline';
import { TimelineChart } from '@/features/timeline/TimelineChart';

import { buildWeekChartOptions } from './weekChartOptions';

export function WeekTimeline({ week, site, label }: { week: Timeline; site: Site; label: string }): JSX.Element {
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
      continuesLabel="continues past this week"
      label={label}
      testId="week-timeline"
      onInstantClick={openNightAt}
    />
  );
}
