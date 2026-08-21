import type { JSX } from 'react';

import { useNow } from '@/app/useNow';
import { useSelection } from '@/app/useSelection';
import { useSemester } from '@/app/useSemester';
import { useUrlParam } from '@/app/useUrlParam';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorAlert, Loading } from '@/components/ui/PageStatus';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { buildSemesterTimeline } from '@/domain/semesterTimeline';
import { SemesterBlockTable } from '@/features/semester/SemesterBlockTable';
import { SemesterCalendar, SemesterCalendarLegend } from '@/features/semester/SemesterCalendar';
import { SemesterTimeline, SemesterTimelineLegend } from '@/features/semester/SemesterTimeline';
import {
  calendarLegendExtras,
  modeLegendExtras,
  telescopeLegendExtras,
  tooLegendExtras,
} from '@/features/timeline/timelineOptions';
import { useSemesterSchedule } from '@/gql/hooks';

/**
 * Two readings of one semester.
 *
 * They are not fallbacks for each other, which is why this is a control rather
 * than a breakpoint. Each answers a question the other answers badly:
 *
 * - **Chart** - how long does a run last? Blocks keep their true intervals, so a
 *   night that changes partway through is drawn where it changes.
 * - **Calendar** - what can I do on a given night? The week structure and the
 *   moon, which a linear axis hides.
 *
 * Both project from the same placed blocks (`domain/timeline.ts`). The DOM grid
 * an earlier revision carried built its own cells from the raw records and
 * drifted away from the chart on closures, on A&G and on colour, silently.
 */
type View = 'chart' | 'calendar';

const VIEW_OPTIONS = [
  { label: 'Chart', value: 'chart' as const },
  { label: 'Calendar', value: 'calendar' as const },
];

/** The semester runs for months, so the "today" marker needs no fine tick. */
const NOW_TICK_MS = 5 * 60_000;

/**
 * The semester schedule - the readable reproduction of what Gemini publishes.
 *
 * Site and semester live in the URL, so a view is linkable and reloads where it
 * was. The interval asked for spans the whole semester in one request: the view
 * draws all of it, so paging it would only mean drawing it twice.
 */
export default function SemesterPage(): JSX.Element {
  const { site } = useSelection();
  // The resolved semester - the same reading the masthead shows, so the page
  // and the control can never disagree (app/useSemester.ts).
  const { semester: selected, loading: loadingSets, error: setsError } = useSemester();
  // In the URL, so "look at the calendar" is a sendable link, not a set of
  // clicks to describe. An unrecognised value reads as the default chart. The
  // month goes with it when the view changes: a chart link carries just the
  // semester, and only a calendar link names one of its months.
  const [viewParam, setView] = useUrlParam('view', 'chart', { clears: ['month'] });
  const view: View = viewParam === 'calendar' ? viewParam : 'chart';
  const now = useNow(NOW_TICK_MS);

  const bounds =
    selected === null
      ? null
      : {
          // The first night starts the evening before it is labelled, and the
          // last one ends the following afternoon - so reach a day either side
          // and let the records answer for themselves.
          start: `${selected.firstNight}T00:00:00.000Z`,
          end: `${selected.lastNight}T23:59:59.999Z`,
        };

  const { mountings, closures, tooBlocks, modeBlocks, loading, error } = useSemesterSchedule(
    selected?.site ?? site,
    bounds,
  );

  // One timeline for every view: the chart draws its blocks, the calendar
  // projects them onto nights. Building it once is what makes disagreeing
  // impossible.
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

  // The state values on the legend, in the words the blocks print. The
  // calendar keys only the notable ones - the only ones it draws as bars.
  const telescopeExtras = telescopeLegendExtras(closures);
  const modeExtras = modeLegendExtras(modeBlocks);
  const tooExtras = tooLegendExtras(tooBlocks);
  // The chart shades weekends and marks today; the calendar draws its own
  // chrome and keys only hues, so it takes none of this.
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
          {/*
            Every view is a picture, so the text reading rides alongside all of
            them rather than being one of them. One row per block, which is the
            fact - not one per night, which is the drawing.
          */}
          {/*
            The caption names the schedule without repeating the heading: the
            heading already carries the published title, and a caption echoing it
            verbatim gives a screen reader the same sentence twice.
          */}
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
              {/* Chips carry their words, so the calendar keys only the hues
                  and the closure - never treatment keys for bars it no longer
                  draws. */}
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
