import { when } from '@gemini-hlsw/lucuma-common-ui';
import { Button } from 'primereact/button';
import type { JSX } from 'react';

import { useNow } from '@/app/useNow';
import { useSelection } from '@/app/useSelection';
import { ChevronLeft, ChevronRight } from '@/components/ui/Icons';
import { SemesterTitleLink } from '@/components/ui/SemesterTitleLink';
import { SyntheticDataTag } from '@/components/ui/SyntheticDataTag';
import { coverageRanges, nearestCoveredNight } from '@/domain/coverage';
import { moonPhaseAt, moonPhaseLabel } from '@/domain/moon';
import { buildNightTimeline } from '@/domain/nightTimeline';
import { addDays } from '@/domain/semester';
import { observingNightInterval } from '@/domain/siteTime';
import type { PublishedSemester, Site } from '@/domain/types';
import { buildNightChartOptions, clockLabel } from '@/features/night/nightChartOptions';
import { NightComponentsTable } from '@/features/night/NightComponentsTable';
import { TimelineChart, TimelineLegendBar } from '@/features/timeline/TimelineChart';
import { modeLegendExtras, telescopeLegendExtras, tooLegendExtras } from '@/features/timeline/timelineOptions';
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
 * night (PLAN.md §3.1), the sun shades the hours nobody can observe in, and an
 * un-entered night says so instead of looking like an idle telescope.
 */
export default function NightPage(): JSX.Element {
  const { site, observingNight, tonight, timeDisplay, setObservingNight, clearObservingNight } = useSelection();
  const { semesters, loading: loadingSets, error: setsError } = usePublishedSemesters();
  const now = useNow(NOW_TICK_MS);

  const interval = observingNightInterval(site, observingNight);
  const held = semesterHolding(semesters, site, observingNight);

  const { mountings, closures, tooBlocks, modeBlocks, loading, error, dataAvailable, nightComponents } =
    useNightSchedule(site, observingNight, toApiInterval(interval));

  const night = buildNightTimeline({
    site,
    observingNight,
    rowLabels: held?.rowLabels ?? [],
    mountings,
    closures,
    tooBlocks,
    modeBlocks,
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
      <header className="mb-4 flex flex-wrap items-end gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-foreground">Night of {observingNight}</h1>
            {when(held?.demo, () => (
              <SyntheticDataTag />
            ))}
          </div>
          <p className="mt-1 text-xs text-foreground-muted">
            {clockLabel(interval.start, site, timeDisplay)} to {clockLabel(interval.end, site, timeDisplay)}{' '}
            {timeDisplay === 'utc' ? 'UTC' : 'site time'}, labelled by the date it ends. {moon}.
            {when(held, (held) => (
              <>
                {' '}
                <SemesterTitleLink semester={held} />.
              </>
            ))}
          </p>
        </div>

        <div className="ml-auto flex items-end gap-3">
          {/* FontAwesome, not PrimeReact's `icon="pi pi-…"`: this app never
              loads PrimeIcons, so those buttons rendered as empty boxes. */}
          <div className="xp-toolbar">
            {/* From a deep link, back to the night in progress without typing
                a date. Disabled when this already is tonight. */}
            <Button
              size="small"
              severity="secondary"
              disabled={observingNight === tonight}
              onClick={clearObservingNight}
              className="mr-1"
            >
              Tonight
            </Button>
            <Button
              text
              size="small"
              aria-label="Previous night"
              onClick={() => {
                setObservingNight(addDays(observingNight, -1));
              }}
            >
              <ChevronLeft />
            </Button>
            <input
              type="date"
              value={observingNight}
              aria-label="Observing night"
              className="rounded border border-subtle bg-surface px-2 py-1 text-xs text-foreground"
              onChange={(event) => {
                if (event.target.value !== '') {
                  setObservingNight(event.target.value);
                }
              }}
            />
            <Button
              text
              size="small"
              aria-label="Next night"
              onClick={() => {
                setObservingNight(addDays(observingNight, 1));
              }}
            >
              <ChevronRight />
            </Button>
          </div>
        </div>
      </header>

      {when(failure, (failure) => (
        <p role="alert" className="mb-4 rounded border border-red-700/60 bg-red-900/30 p-3 text-sm text-red-100">
          Could not load the night: {failure.message}
        </p>
      ))}

      {busy && <p className="text-sm text-foreground-muted">Loading the night…</p>}

      {!busy && held === undefined && (
        // Not a dead end: say what is covered and offer the nearest covered
        // night, instead of leaving the reader to type dates until one lands.
        <div className="rounded border border-subtle bg-surface p-3 text-sm text-foreground-secondary">
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
        </div>
      )}

      {!busy && held !== undefined && dataAvailable === false && (
        // I4: absence is "not recorded", never "unavailable". Saying so plainly
        // is the whole reason this view asks telescopeNight for the flag.
        <p className="rounded border border-subtle bg-surface p-3 text-sm text-foreground-secondary">
          Nothing is recorded for this night. That is not the same as nothing being available.
        </p>
      )}

      {!busy && held !== undefined && dataAvailable !== false && (
        <>
          <TimelineLegendBar
            legend={night}
            telescope={telescopeLegendExtras(closures)}
            mode={modeLegendExtras(modeBlocks)}
            too={tooLegendExtras(tooBlocks)}
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
