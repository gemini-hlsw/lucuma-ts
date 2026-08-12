import { when } from '@gemini-hlsw/lucuma-common-ui';
import { Button } from 'primereact/button';
import type { JSX } from 'react';

import { useNow } from '@/app/useNow';
import { useOpenNight } from '@/app/useOpenNight';
import { useSelection } from '@/app/useSelection';
import { ChevronLeft, ChevronRight } from '@/components/ui/Icons';
import { SemesterTitleLink } from '@/components/ui/SemesterTitleLink';
import { SyntheticDataTag } from '@/components/ui/SyntheticDataTag';
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

/** Any published semester overlapping the week, for the row labels and title. */
const semesterOverlapping = (
  semesters: readonly PublishedSemester[],
  site: Site,
  nights: readonly string[],
): PublishedSemester | undefined =>
  semesters.find(
    (entry) => entry.site === site && nights.some((night) => entry.firstNight <= night && night <= entry.lastNight),
  );

/**
 * Seven observing nights.
 *
 * The window between the two other views: wide enough to plan against, narrow
 * enough that each night keeps its shape - the sun shades every night, so you
 * can see the usable hours across a week rather than just which instrument is
 * mounted.
 */
export default function WeekPage(): JSX.Element {
  const { site, observingNight, tonight, timeDisplay, setObservingNight, clearObservingNight } = useSelection();
  const { semesters, loading: loadingSets, error: setsError } = usePublishedSemesters();
  const now = useNow(NOW_TICK_MS);

  const nightLabels = weekNightLabels(observingNight);
  const held = semesterOverlapping(semesters, site, nightLabels);
  const rowLabels = held?.rowLabels ?? [];

  // The page speaks evening dates - the date each night begins, which is how
  // the published columns, the chart axis and the cards are all headed. The
  // observing-night labels stay in the URL, shared with the night view.
  const firstEvening = addDays(observingNight, -1);
  const lastEvening = addDays(observingNight, WEEK_NIGHTS - 2);

  // The scheduler's own query takes a half-open date range, so the end is the
  // night after the last one shown.
  const nights = { start: observingNight, end: addDays(observingNight, WEEK_NIGHTS) };

  const draft = buildWeekTimeline({
    site,
    firstNight: observingNight,
    rowLabels: [],
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
    rowLabels,
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
  const step = (days: number) => () => {
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
      <header className="mb-4 flex flex-wrap items-end gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-foreground">
              Nights beginning {firstEvening} to {lastEvening}
            </h1>
            {when(held?.demo, () => (
              <SyntheticDataTag />
            ))}
          </div>
          <p className="mt-1 text-xs text-foreground-muted">
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
          </p>
        </div>

        <div className="ml-auto flex items-end gap-3">
          <div className="xp-toolbar">
            {/* From a deep link, back to the week that starts tonight without
                typing a date. Disabled when tonight already leads the week. */}
            <Button
              size="small"
              severity="secondary"
              disabled={observingNight === tonight}
              onClick={clearObservingNight}
              className="mr-1"
            >
              Tonight
            </Button>
            <Button text size="small" aria-label="Previous week" onClick={step(-WEEK_NIGHTS)}>
              <ChevronLeft />
            </Button>
            <input
              type="date"
              // The evening the week's first night begins - the page's one date
              // vocabulary - converted back to the night label the URL carries.
              value={firstEvening}
              aria-label="First evening"
              className="rounded border border-subtle bg-surface px-2 py-1 text-xs text-foreground"
              onChange={(event) => {
                if (event.target.value !== '') {
                  setObservingNight(addDays(event.target.value, 1));
                }
              }}
            />
            <Button text size="small" aria-label="Next week" onClick={step(WEEK_NIGHTS)}>
              <ChevronRight />
            </Button>
          </div>
        </div>
      </header>

      {when(failure, (failure) => (
        <p role="alert" className="mb-4 rounded border border-red-700/60 bg-red-900/30 p-3 text-sm text-red-100">
          Could not load the week: {failure.message}
        </p>
      ))}

      {busy && <p className="text-sm text-foreground-muted">Loading the week…</p>}

      {!busy && held === undefined && (
        <p className="rounded border border-subtle bg-surface p-3 text-sm text-foreground-secondary">
          No published schedule covers these nights at {site}.
        </p>
      )}

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
