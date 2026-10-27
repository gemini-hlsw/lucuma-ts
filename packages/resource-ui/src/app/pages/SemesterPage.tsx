import { Dropdown } from 'primereact/dropdown';
import type { JSX } from 'react';

import { useNow } from '@/app/useNow';
import { useSelection } from '@/app/useSelection';
import { useSemester } from '@/app/useSemester';
import { LabelledControl } from '@/components/ui/LabelledControl';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorAlert, Loading } from '@/components/ui/PageStatus';
import { toApiInterval } from '@/domain/adapters';
import { buildSemesterTimeline } from '@/domain/semesterTimeline';
import { observingNightInterval } from '@/domain/siteTime';
import { SemesterBlockTable } from '@/features/semester/SemesterBlockTable';
import { SemesterTimeline, SemesterTimelineLegend } from '@/features/semester/SemesterTimeline';
import {
  calendarLegendExtras,
  modeLegendExtras,
  telescopeLegendExtras,
  tooLegendExtras,
} from '@/features/timeline/timelineOptions';
import { useSemesterSchedule } from '@/gql/hooks';

/** The semester runs for months, so the "today" marker needs no fine tick. */
const NOW_TICK_MS = 5 * 60_000;

/** The whole semester in one request: the view draws all of it, so paging would draw it twice. */
export default function SemesterPage(): JSX.Element {
  const { site } = useSelection();
  const { semester: selected, semestersForSite, setSemester, loading: loadingSets, error: setsError } = useSemester();
  const now = useNow(NOW_TICK_MS);

  const bounds =
    selected === null
      ? null
      : {
          // The observing-night interval, not the calendar day: a night runs 14:00 local to 14:00 local.
          start: toApiInterval(observingNightInterval(selected.site, selected.firstNight)).start,
          end: toApiInterval(observingNightInterval(selected.site, selected.lastNight)).end,
        };

  const { instrumentAvailability, telescopeAvailability, tooSupport, telescopeMode, loading, error } =
    useSemesterSchedule(selected?.site ?? site, bounds);

  const timeline =
    selected === null
      ? null
      : buildSemesterTimeline({
          site: selected.site,
          firstNight: selected.firstNight,
          lastNight: selected.lastNight,
          instrumentAvailability,
          telescopeAvailability,
          tooSupport,
          telescopeMode,
        });

  const telescopeExtras = telescopeLegendExtras(telescopeAvailability);
  const modeExtras = modeLegendExtras(telescopeMode);
  const tooExtras = tooLegendExtras(tooSupport);
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
        title={selected === null ? 'Semester schedule' : `Semester ${selected.semester}`}
        actions={
          <LabelledControl
            label="Semester"
            className="flex min-w-0 flex-col gap-1"
            labelClassName="text-xs font-semibold tracking-wider text-foreground uppercase"
          >
            {(id) => (
              <Dropdown
                inputId={id}
                name="semester"
                value={selected?.semester ?? null}
                // Says why it is empty rather than looking broken.
                placeholder="None"
                options={semestersForSite.map((entry) => entry.semester)}
                onChange={(event) => {
                  setSemester(event.value as string);
                }}
                className="xp-page-select w-[9.5rem] max-w-full"
                pt={{
                  // The native select mirrors the combobox for form submission; unnamed in the
                  // accessibility tree it is a second, anonymous control saying the same thing.
                  // On the select itself, not its wrapper: PrimeReact gives that wrapper's key to
                  // the readonly input too, and hiding that would erase the only keyboard stop.
                  select: { 'aria-hidden': true },
                  // Stock PrimeReact points this at `dropdownItem_-1` whenever the un-roled root is
                  // focused with no option active - an id that never exists, on an element with no role.
                  root: { 'aria-activedescendant': undefined },
                }}
              />
            )}
          </LabelledControl>
        }
      />

      {failure !== undefined && <ErrorAlert what="the schedule" error={failure} />}

      {(loadingSets || loading) && <Loading what="the schedule" />}

      {timeline !== null && selected !== null && !loading && (
        <>
          {/* One row per block, which is the fact, not one per night, which is the drawing. */}
          <SemesterBlockTable
            timeline={timeline}
            site={selected.site}
            caption={`${selected.site} ${selected.semester} schedule, one row per block`}
          />

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
    </div>
  );
}
