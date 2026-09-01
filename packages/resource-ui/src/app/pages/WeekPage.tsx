import { when } from '@gemini-hlsw/lucuma-common-ui';
import type { JSX } from 'react';

import { useNow } from '@/app/useNow';
import { useOpenNight } from '@/app/useOpenNight';
import { useSelection } from '@/app/useSelection';
import { NightStepper } from '@/components/ui/NightStepper';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyPanel, ErrorAlert, Loading } from '@/components/ui/PageStatus';
import { SemesterTitleLink } from '@/components/ui/SemesterTitleLink';
import { addDays } from '@/domain/semester';
import { nightAt } from '@/domain/timeline';
import type { PublishedSemester, Site } from '@/domain/types';
import { buildWeekChanges, buildWeekNightFacts, summarizeWeek } from '@/domain/weekBriefing';
import { buildWeekTimeline, WEEK_NIGHTS, weekNightLabels } from '@/domain/weekTimeline';
import { TimelineChart, TimelineLegendBar } from '@/features/timeline/TimelineChart';
import {
  calendarLegendExtras,
  modeLegendExtras,
  skyLegendExtras,
  telescopeLegendExtras,
  tooLegendExtras,
} from '@/features/timeline/timelineOptions';
import { WeekChangesTable, WeekNightStrip } from '@/features/week/WeekBriefing';
import { buildWeekChartOptions } from '@/features/week/weekChartOptions';
import { toApiInterval, usePublishedSemesters, useWeekSchedule } from '@/gql/hooks';

/** A week is long enough that the marker needs no fine tick. */
const NOW_TICK_MS = 5 * 60_000;

/** Any published semester overlapping the week: the title link, the demo tag, holidays and moons. */
const semesterOverlapping = (
  semesters: readonly PublishedSemester[],
  site: Site,
  nights: readonly string[],
): PublishedSemester | undefined =>
  semesters.find(
    (entry) => entry.site === site && nights.some((night) => entry.firstNight <= night && night <= entry.lastNight),
  );

/** Wide enough to plan against, narrow enough that each night keeps its shape under the sun wash. */
export default function WeekPage(): JSX.Element {
  const { site, observingNight, tonight, timeDisplay, setObservingNight, clearObservingNight } = useSelection();
  const { semesters, loading: loadingSets, error: setsError } = usePublishedSemesters();
  const now = useNow(NOW_TICK_MS);

  const nightLabels = weekNightLabels(observingNight);
  const held = semesterOverlapping(semesters, site, nightLabels);

  // The page speaks evening dates; the observing-night labels stay in the URL.
  const firstEvening = addDays(observingNight, -1);
  const lastEvening = addDays(observingNight, WEEK_NIGHTS - 2);

  // The scheduler's query takes a half-open date range, so the end is the night after the last shown.
  const nights = { start: observingNight, end: addDays(observingNight, WEEK_NIGHTS) };

  const draft = buildWeekTimeline({
    site,
    firstNight: observingNight,
    mountings: [],
    closures: [],
    nightsWithData: undefined,
  });
  const bounds = toApiInterval(draft.interval);

  const {
    mountings,
    closures,
    tooBlocks,
    modeBlocks,
    loading,
    error,
    nightsWithData,
    nightsResolved,
    nightComponents,
  } = useWeekSchedule(site, nights, bounds);

  const week = buildWeekTimeline({
    site,
    firstNight: observingNight,
    mountings,
    closures,
    tooBlocks,
    modeBlocks,
    nightsWithData: nightsResolved ? nightsWithData : undefined,
  });

  const options = buildWeekChartOptions({ week, site, now });

  const holidays = held?.holidays ?? [];
  const moonEvents = held?.moonEvents ?? [];
  const facts = buildWeekNightFacts({ site, nights: week.nights, holidays, moonEvents });
  const summary = summarizeWeek(facts);
  const changes = buildWeekChanges({
    interval: week.interval,
    mountings,
    closures,
    componentBlocks: nightComponents.blocks,
    components: nightComponents.components,
  });

  const failure = setsError ?? error;
  const busy = loadingSets || loading;
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
        demo={held?.demo === true}
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
        published. Daylight and twilight are shaded.
        {when(held, (held) => (
          <>
            {' '}
            <SemesterTitleLink semester={held} />.
          </>
        ))}
        {when(
          summary,
          (summary) =>
            ` ${summary.totalDarkHours.toFixed(0)} h of astronomical dark; moon ${Math.round(
              summary.moonStart.fraction * 100,
            )}% to ${Math.round(summary.moonEnd.fraction * 100)}%.`,
        )}
      </PageHeader>

      {when(failure, (failure) => (
        <ErrorAlert what="the week" error={failure} />
      ))}

      {busy && <Loading what="the week" />}

      {!busy && held === undefined && <EmptyPanel>No published schedule covers these nights at {site}.</EmptyPanel>}

      {!busy && held !== undefined && (
        <>
          <TimelineLegendBar
            legend={week}
            telescope={telescopeLegendExtras(closures)}
            mode={modeLegendExtras(modeBlocks)}
            too={tooLegendExtras(tooBlocks)}
            sky={skyLegendExtras()}
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
          <WeekNightStrip facts={facts} />
          <WeekChangesTable changes={changes} site={site} timeDisplay={timeDisplay} />
        </>
      )}
    </div>
  );
}
