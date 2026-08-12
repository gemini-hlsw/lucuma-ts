import { when } from '@gemini-hlsw/lucuma-common-ui';
import { Button } from 'primereact/button';
import type { JSX } from 'react';

import { useNow } from '@/app/useNow';
import { useSelection } from '@/app/useSelection';
import { NightStepper } from '@/components/ui/NightStepper';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyPanel, ErrorAlert, Loading } from '@/components/ui/PageStatus';
import { SemesterTitleLink } from '@/components/ui/SemesterTitleLink';
import { coverageRanges, nearestCoveredNight } from '@/domain/coverage';
import { moonPhaseAt, moonPhaseLabel } from '@/domain/moon';
import { buildNightTimeline } from '@/domain/nightTimeline';
import { addDays } from '@/domain/semester';
import { observingNightInterval } from '@/domain/siteTime';
import type { PublishedSemester, Site } from '@/domain/types';
import { buildNightChartOptions, clockLabel } from '@/features/night/nightChartOptions';
import { NightComponentsTable } from '@/features/night/NightComponentsTable';
import { TimelineChart, TimelineLegendBar } from '@/features/timeline/TimelineChart';
import {
  calendarLegendExtras,
  modeLegendExtras,
  skyLegendExtras,
  telescopeLegendExtras,
  tooLegendExtras,
} from '@/features/timeline/timelineOptions';
import { toApiInterval, useNightSchedule, usePublishedSemesters } from '@/gql/hooks';

/** A night is short enough that the marker should keep up with the clock. */
const NOW_TICK_MS = 60_000;

/** The published semester whose nights contain this one, if any holds it. */
const semesterHolding = (
  semesters: readonly PublishedSemester[],
  site: Site,
  observingNight: string,
): PublishedSemester | undefined =>
  semesters.find(
    (entry) => entry.site === site && entry.firstNight <= observingNight && observingNight <= entry.lastNight,
  );

/**
 * One observing night, 14:00 local to 14:00 local.
 *
 * This is the view the rest of the model exists for. A run that changes partway
 * through the night is drawn where it changes rather than rounded to a whole
 * night (the partial-night non-negotiable), the sun shades the hours nobody can observe in, and an
 * un-entered night says so instead of looking like an idle telescope.
 */
export default function NightPage(): JSX.Element {
  const { site, observingNight, tonight, timeDisplay, setObservingNight, clearObservingNight } = useSelection();
  const { semesters, loading: loadingSets, error: setsError } = usePublishedSemesters();
  const now = useNow(NOW_TICK_MS);

  const interval = observingNightInterval(site, observingNight);
  const held = semesterHolding(semesters, site, observingNight);

  const {
    mountings,
    closures,
    tooBlocks,
    modeBlocks,
    subsystemBlocks,
    loading,
    error,
    dataAvailable,
    nightComponents,
  } = useNightSchedule(site, observingNight, toApiInterval(interval));

  const night = buildNightTimeline({
    site,
    observingNight,
    mountings,
    closures,
    tooBlocks,
    modeBlocks,
    subsystemBlocks,
  });

  const options = buildNightChartOptions({ night, site, now, timeDisplay });

  const failure = setsError ?? error;
  const moon = moonPhaseLabel(moonPhaseAt((interval.start + interval.end) / 2));
  const busy = loadingSets || loading;

  // Only read on the no-data path; cheap enough not to gate on it.
  const ranges = coverageRanges(semesters, site);
  const nearest = nearestCoveredNight(ranges, observingNight);

  return (
    <div className="min-w-0">
      <PageHeader
        title={`Night of ${observingNight}`}
        demo={held?.demo === true}
        actions={
          // The night's own date vocabulary: the label the URL carries, stepped
          // one night at a time.
          <NightStepper
            value={observingNight}
            onChange={setObservingNight}
            onStep={(days) => {
              setObservingNight(addDays(observingNight, days));
            }}
            step={1}
            dateLabel="Observing night"
            stepLabel="night"
            onTonight={clearObservingNight}
            isTonight={observingNight === tonight}
          />
        }
      >
        {clockLabel(interval.start, site, timeDisplay)} to {clockLabel(interval.end, site, timeDisplay)}{' '}
        {timeDisplay === 'utc' ? 'UTC' : 'site time'}, labelled by the date it ends. {moon}.
        {when(held, (held) => (
          <>
            {' '}
            <SemesterTitleLink semester={held} />.
          </>
        ))}
      </PageHeader>

      {when(failure, (failure) => (
        <ErrorAlert what="the night" error={failure} />
      ))}

      {busy && <Loading what="the night" />}

      {!busy && held === undefined && (
        // Not a dead end: say what is covered and offer the nearest covered
        // night, instead of leaving the reader to type dates until one lands.
        <EmptyPanel>
          <p>
            No published schedule covers this night at {site}.
            {ranges.length > 0 &&
              ` Published nights at ${site} run ${ranges
                .map((range) => `${range.firstNight} to ${range.lastNight}${range.demo ? ' (synthetic demo)' : ''}`)
                .join(', and ')}.`}
          </p>
          {when(nearest, (nearest) => (
            <Button
              size="small"
              outlined
              className="mt-2"
              onClick={() => {
                setObservingNight(nearest);
              }}
            >
              Open the nearest covered night, {nearest}
            </Button>
          ))}
        </EmptyPanel>
      )}

      {!busy && held !== undefined && dataAvailable === false && (
        // I4: absence is "not recorded", never "unavailable". Saying so plainly
        // is the whole reason this view asks telescopeNight for the flag.
        <EmptyPanel>Nothing is recorded for this night. That is not the same as nothing being available.</EmptyPanel>
      )}

      {!busy && held !== undefined && dataAvailable !== false && (
        <>
          <TimelineLegendBar
            legend={night}
            telescope={telescopeLegendExtras(closures)}
            mode={modeLegendExtras(modeBlocks)}
            too={tooLegendExtras(tooBlocks)}
            sky={skyLegendExtras()}
            calendar={calendarLegendExtras({
              now: now !== null && now >= interval.start && now < interval.end && 'Now',
            })}
          />
          {night.transitions.length > 0 && (
            <p className="mb-3 text-xs text-foreground-secondary">
              Changes during the night at{' '}
              {night.transitions.map((instant) => clockLabel(instant, site, timeDisplay)).join(', ')}.
            </p>
          )}
          <TimelineChart
            options={options}
            continuesLabel="continues beyond tonight"
            label={`Night of ${observingNight}`}
            testId="night-timeline"
          />
          <NightComponentsTable
            nightComponents={nightComponents}
            mountings={mountings}
            night={interval}
            site={site}
            timeDisplay={timeDisplay}
          />
        </>
      )}
    </div>
  );
}
