import type { JSX } from 'react';

import { useNow } from '@/app/useNow';
import { useSelection } from '@/app/useSelection';
import { useSemester } from '@/app/useSemester';
import { useUrlParam } from '@/app/useUrlParam';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorAlert, Loading } from '@/components/ui/PageStatus';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { buildSemesterTimeline } from '@/domain/semesterTimeline';
import { observingNightInterval } from '@/domain/siteTime';
import { SemesterBlockTable } from '@/features/semester/SemesterBlockTable';
import { SemesterCalendar, SemesterCalendarLegend } from '@/features/semester/SemesterCalendar';
import { SemesterTimeline, SemesterTimelineLegend } from '@/features/semester/SemesterTimeline';
import {
  calendarLegendExtras,
  modeLegendExtras,
  telescopeLegendExtras,
  tooLegendExtras,
} from '@/features/timeline/timelineOptions';
import { toApiInterval, useSemesterSchedule } from '@/gql/hooks';

/** Not fallbacks for each other: both project from the same placed blocks, so neither can drift. */
type View = 'chart' | 'calendar';

const VIEW_OPTIONS = [
  { label: 'Chart', value: 'chart' as const },
  { label: 'Calendar', value: 'calendar' as const },
];

/** The semester runs for months, so the "today" marker needs no fine tick. */
const NOW_TICK_MS = 5 * 60_000;

/** The whole semester in one request: the view draws all of it, so paging would draw it twice. */
export default function SemesterPage(): JSX.Element {
  const { site } = useSelection();
  const { semester: selected, loading: loadingSets, error: setsError } = useSemester();
  // In the URL, so "look at the calendar" is a sendable link.
  const [viewParam, setView] = useUrlParam('view', 'chart', { clears: ['month'] });
  const view: View = viewParam === 'calendar' ? viewParam : 'chart';
  const now = useNow(NOW_TICK_MS);

  const bounds =
    selected === null
      ? null
      : {
          // The observing-night interval, not the calendar day: a night runs 14:00 local to 14:00 local.
          start: toApiInterval(observingNightInterval(selected.site, selected.firstNight)).start,
          end: toApiInterval(observingNightInterval(selected.site, selected.lastNight)).end,
        };

  const { mountings, closures, tooBlocks, modeBlocks, loading, error } = useSemesterSchedule(
    selected?.site ?? site,
    bounds,
  );

  const timeline =
    selected === null
      ? null
      : buildSemesterTimeline({
          site: selected.site,
          firstNight: selected.firstNight,
          lastNight: selected.lastNight,
          mountings,
          closures,
          tooBlocks,
          modeBlocks,
        });

  // The state values on the chart's legend, in the words the blocks print.
  const telescopeExtras = telescopeLegendExtras(closures);
  const modeExtras = modeLegendExtras(modeBlocks);
  const tooExtras = tooLegendExtras(tooBlocks);
  // The calendar draws its own chrome and keys only hues, so it takes none of this.
  const semesterNights = timeline?.months.flatMap((month) => month.nights) ?? [];
  const calendarExtras = calendarLegendExtras({
    weekend: true,
    now:
      now !== null &&
      semesterNights.some((night) => now >= night.interval.start && now < night.interval.end) &&
      'Today',
  });

  const failure = setsError ?? error;

  return (
    <div className="min-w-0">
      <PageHeader
        title={selected?.title ?? 'Semester schedule'}
        demo={selected?.demo === true}
        actions={
          <SegmentedControl
            value={view}
            options={VIEW_OPTIONS}
            onChange={setView}
            ariaLabel="View"
            size="sm"
            testId="semester-view"
          />
        }
      >
        {selected === null
          ? 'Choose a site and semester.'
          : `Nights ${selected.firstNight} to ${selected.lastNight}. Columns are headed by the date each night begins, as published.`}
        {typeof selected?.version === 'string' && ` Published version: ${selected.version}.`}
      </PageHeader>

      {failure !== undefined && <ErrorAlert what="the schedule" error={failure} />}

      {(loadingSets || loading) && <Loading what="the schedule" />}

      {timeline !== null && selected !== null && !loading && (
        <>
          {/* One row per block, which is the fact, not one per night, which is the drawing. */}
          {/* The heading already carries the published title; a caption echoing it says it twice. */}
          <SemesterBlockTable
            timeline={timeline}
            site={selected.site}
            caption={`${selected.site} ${selected.semester} schedule, one row per block`}
          />

          {view === 'chart' && (
            <>
              <SemesterTimelineLegend
                legend={timeline}
                telescope={telescopeExtras}
                mode={modeExtras}
                too={tooExtras}
                calendar={calendarExtras}
              />
              <SemesterTimeline timeline={timeline} site={selected.site} now={now} />
            </>
          )}

          {view === 'calendar' && (
            <>
              {/* Chips carry their words, so the calendar keys only the hues and the closure. */}
              <SemesterCalendarLegend
                legend={{ ...timeline, hasUnscheduled: false, hasEngineeringUse: false, hasUnavailable: false }}
              />
              <SemesterCalendar
                timeline={timeline}
                semester={selected}
                site={selected.site}
                mountings={mountings}
                closures={closures}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}
