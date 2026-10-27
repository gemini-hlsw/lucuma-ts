import { when } from '@gemini-hlsw/lucuma-common-ui';
import type { JSX } from 'react';

import { useClockPreference } from '@/app/useClockPreference';
import { useNow } from '@/app/useNow';
import { useOpenNight } from '@/app/useOpenNight';
import { useSelection } from '@/app/useSelection';
import { NightStepper } from '@/components/ui/NightStepper';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyPanel, ErrorAlert, Loading } from '@/components/ui/PageStatus';
import { toApiInterval } from '@/domain/adapters';
import { addDays } from '@/domain/semester';
import { nightAt } from '@/domain/timeline';
import { buildWeekChanges } from '@/domain/weekChanges';
import { buildWeekTimeline, WEEK_NIGHTS } from '@/domain/weekTimeline';
import { TimelineChart, TimelineLegendBar } from '@/features/timeline/TimelineChart';
import {
  calendarLegendExtras,
  modeLegendExtras,
  telescopeLegendExtras,
  tooLegendExtras,
} from '@/features/timeline/timelineOptions';
import { WeekChangesTable } from '@/features/week/WeekChangesTable';
import { buildWeekChartOptions } from '@/features/week/weekChartOptions';
import { useWeekSchedule } from '@/gql/hooks';

/** A week is long enough that the marker needs no fine tick. */
const NOW_TICK_MS = 5 * 60_000;

export default function WeekPage(): JSX.Element {
  const { site, observingNight, tonight, setObservingNight, clearObservingNight } = useSelection();
  const timeDisplay = useClockPreference();
  const now = useNow(NOW_TICK_MS);

  // The page speaks evening dates; the observing-night labels stay in the URL.
  const firstEvening = addDays(observingNight, -1);
  const lastEvening = addDays(observingNight, WEEK_NIGHTS - 2);

  // The scheduler's query takes a half-open date range, so the end is the night after the last shown.
  const nights = { start: observingNight, end: addDays(observingNight, WEEK_NIGHTS) };

  const draft = buildWeekTimeline({
    site,
    firstNight: observingNight,
    instrumentAvailability: [],
    telescopeAvailability: [],
    nightsWithData: undefined,
  });
  const bounds = toApiInterval(draft.interval);

  const {
    instrumentAvailability,
    telescopeAvailability,
    tooSupport,
    telescopeMode,
    loading,
    error,
    nightsWithData,
    nightsResolved,
    nightComponents,
  } = useWeekSchedule(site, nights, bounds);

  const week = buildWeekTimeline({
    site,
    firstNight: observingNight,
    instrumentAvailability,
    telescopeAvailability,
    tooSupport,
    telescopeMode,
    nightsWithData: nightsResolved ? nightsWithData : undefined,
  });

  const options = buildWeekChartOptions({ week, site, now });

  const changes = buildWeekChanges({
    interval: week.interval,
    instrumentAvailability,
    telescopeAvailability,
    componentAvailability: nightComponents.blocks,
    components: nightComponents.components,
  });

  const nothingRecorded = week.nights.every((night) => !night.dataAvailable);

  const step = (days: number): void => {
    setObservingNight(addDays(observingNight, days));
  };

  const openNight = useOpenNight();
  const openNightAt = (instant: number): void => {
    const night = nightAt(week.nights, instant);
    if (night !== null) {
      openNight(night.observingNight);
    }
  };

  return (
    <div className="min-w-0">
      <PageHeader
        title={`Nights beginning ${firstEvening} to ${lastEvening}`}
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
      >
        Seven observing nights, each 14:00 to 14:00 site time. Columns are headed by the date each night begins, as
        published.
      </PageHeader>

      {when(error, (error) => (
        <ErrorAlert what="the week" error={error} />
      ))}

      {loading && <Loading what="the week" />}

      {!loading && nothingRecorded && <EmptyPanel>Nothing is recorded for this week.</EmptyPanel>}

      {!loading && !nothingRecorded && (
        <>
          <TimelineLegendBar
            legend={week}
            telescope={telescopeLegendExtras(telescopeAvailability)}
            mode={modeLegendExtras(telescopeMode)}
            too={tooLegendExtras(tooSupport)}
            calendar={calendarLegendExtras({
              weekend: week.nights.some((night) => night.isWeekend),
              now: now !== null && now >= week.interval.start && now < week.interval.end && 'Now',
              noData: week.nights.some((night) => !night.dataAvailable),
            })}
          />
          <TimelineChart
            options={options}
            continuesLabel="continues past this week"
            label={`Nights beginning ${firstEvening} to ${lastEvening}`}
            testId="week-timeline"
            onInstantClick={openNightAt}
          />
          <WeekChangesTable changes={changes} site={site} timeDisplay={timeDisplay} />
        </>
      )}
    </div>
  );
}
