import { when } from '@gemini-hlsw/lucuma-common-ui';
import type { JSX } from 'react';

import { nightBoundaries, useNow } from '@/app/useNow';
import { useSelection } from '@/app/useSelection';
import { NightStepper } from '@/components/ui/NightStepper';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyPanel, ErrorAlert, Loading } from '@/components/ui/PageStatus';
import { toApiInterval } from '@/domain/adapters';
import { addDays } from '@/domain/semester';
import { EMPTY_SCHEDULE } from '@/domain/types';
import { buildWeekTimeline, WEEK_NIGHTS } from '@/domain/weekTimeline';
import { TimelineLegendBar } from '@/features/timeline/TimelineChart';
import { WeekTimeline } from '@/features/week/WeekTimeline';
import { useWeekSchedule } from '@/gql/hooks';

export default function WeekPage(): JSX.Element {
  const { site, observingNight, tonight, setObservingNight, clearObservingNight } = useSelection();
  const now = useNow(nightBoundaries(site));

  // The page speaks evening dates; the observing-night labels stay in the URL.
  const firstEvening = addDays(observingNight, -1);
  const lastEvening = addDays(observingNight, WEEK_NIGHTS - 2);
  const title = `Nights beginning ${firstEvening} to ${lastEvening}`;

  // The scheduler's query takes a half-open date range, so the end is the night after the last shown.
  const nights = { start: observingNight, end: addDays(observingNight, WEEK_NIGHTS) };

  const draft = buildWeekTimeline({
    site,
    firstNight: observingNight,
    schedule: EMPTY_SCHEDULE,
    nightsWithData: undefined,
  });
  const bounds = toApiInterval(draft.interval);

  const { schedule, loading, error, nightsWithData, nightsResolved } = useWeekSchedule(site, nights, bounds);

  const week = buildWeekTimeline({
    site,
    firstNight: observingNight,
    schedule,
    nightsWithData: nightsResolved ? nightsWithData : undefined,
  });

  const nothingRecorded = week.nights.every((night) => !night.dataAvailable);

  const step = (days: number): void => {
    setObservingNight(addDays(observingNight, days));
  };

  return (
    <div className="min-w-0">
      <PageHeader
        title={title}
        actions={
          <NightStepper
            value={firstEvening}
            onChange={(evening) => {
              setObservingNight(addDays(evening, 1));
            }}
            onStep={step}
            step={WEEK_NIGHTS}
            dateLabel="First evening"
            stepLabel="week"
            onTonight={clearObservingNight}
            isTonight={observingNight === tonight}
          />
        }
      />

      {when(error, (error) => (
        <ErrorAlert what="the week" error={error} />
      ))}

      {loading && <Loading what="the week" />}

      {!loading && nothingRecorded && <EmptyPanel>Nothing is recorded for this week.</EmptyPanel>}

      {!loading && !nothingRecorded && (
        <>
          <TimelineLegendBar legend={week.legend} span={week.interval} now={now} />
          <WeekTimeline week={week} site={site} label={title} />
        </>
      )}
    </div>
  );
}
