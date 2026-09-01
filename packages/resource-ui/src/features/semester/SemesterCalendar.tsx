import 'react-big-calendar/lib/css/react-big-calendar.css';

import { format, getDay, parse, startOfWeek } from 'date-fns';
import { enUS } from 'date-fns/locale';
import { Button } from 'primereact/button';
import { Dropdown } from 'primereact/dropdown';
import { cloneElement, type JSX } from 'react';
import {
  Calendar,
  type DateCellWrapperProps,
  dateFnsLocalizer,
  type DateHeaderProps,
  type SlotInfo,
  type ToolbarProps,
} from 'react-big-calendar';

import { useOpenNight } from '@/app/useOpenNight';
import { useUrlParam } from '@/app/useUrlParam';
import { ChevronLeft, ChevronRight } from '@/components/ui/Icons';
import { buildCalendarNews } from '@/domain/calendarNews';
import { buildCalendarNights, type CalendarNight } from '@/domain/calendarNights';
import { moonPhaseLabel } from '@/domain/moon';
import { addDays } from '@/domain/semester';
import type { SemesterTimeline as Timeline } from '@/domain/semesterTimeline';
import type { TimelineNight } from '@/domain/timeline';
import type { Closure, Mounting, PublishedSemester, Site } from '@/domain/types';
import { MoonDisc } from '@/features/calendar/MoonDisc';
import { instrumentColor, instrumentInk, stateFill, stateFillInk } from '@/features/timeline/timelineOptions';

// The calendar's key is instruments, unscheduled and closure - never per-night cell states.
export { TimelineLegendBar as SemesterCalendarLegend } from '@/features/timeline/TimelineChart';

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  // The sheets are published in English at both sites, weeks starting Sunday as the grids do.
  locales: { 'en-US': enUS },
});

/** A news chip - one critical event on one evening's square. */
interface NightEvent {
  readonly title: string;
  /** Local midnight of the chip's evening. */
  readonly start: Date;
  /** Exclusive: local midnight after it - react-big-calendar's all-day span. */
  readonly end: Date;
  readonly allDay: true;
  readonly tooltip: string;
  /** ISO evening date of `start`, for click-through. */
  readonly firstEvening: string;
  readonly color: string;
  readonly ink: string;
}

const pad = (value: number): string => String(value).padStart(2, '0');

/** ISO evening date -> local midnight. */
const localDateOf = (iso: string): Date => {
  const [year = 0, month = 1, day = 1] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
};

/** Local Date -> ISO evening date. The inverse of {@link localDateOf}. */
const isoOf = (date: Date): string =>
  `${String(date.getFullYear()).padStart(4, '0')}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** The month a date falls in, as the URL spells it: "2026-11". */
const monthKeyOf = (date: Date): string => `${String(date.getFullYear()).padStart(4, '0')}-${pad(date.getMonth() + 1)}`;

/** The semester's critical events as single-evening chips. */
// Mutable return: react-big-calendar's `events` prop rejects readonly arrays.
const buildEvents = (
  nights: readonly TimelineNight[],
  mountings: readonly Mounting[],
  closures: readonly Closure[],
): NightEvent[] =>
  buildCalendarNews({ nights, mountings, closures }).map((item) => ({
    title: item.label,
    start: localDateOf(item.eveningDate),
    end: localDateOf(addDays(item.eveningDate, 1)),
    allDay: true,
    tooltip: [item.rowLabel, item.label, item.detail !== null && item.detail !== item.label ? item.detail : null]
      .filter((part) => part !== null && part !== '')
      .join(' · '),
    firstEvening: item.eveningDate,
    color:
      item.kind === 'CLOSED'
        ? 'var(--schedule-closed)'
        : item.instrument === null
          ? stateFill(false)
          : instrumentColor(item.instrument),
    ink:
      item.kind === 'CLOSED'
        ? 'var(--instrument-ink-light)'
        : item.instrument === null
          ? stateFillInk(false)
          : instrumentInk(item.instrument),
  }));

/** A night's full sentence, for the square's tooltip and assistive tech. */
const describeNight = (night: CalendarNight): string => {
  const parts = [
    `Night beginning ${night.eveningDate}`,
    moonPhaseLabel(night.moon),
    night.darkHours === null ? null : `${night.darkHours.toFixed(1)} hours of astronomical dark`,
    night.isHoliday ? 'public holiday' : null,
    night.closed ? (night.closureReason ?? 'telescope shut down') : null,
  ];
  return parts.filter((part) => part !== null).join('. ');
};

export function SemesterCalendar({
  timeline,
  semester,
  site,
  mountings,
  closures,
}: {
  timeline: Timeline;
  semester: PublishedSemester;
  site: Site;
  /** The raw records the news projection reads (`domain/calendarNews.ts`). */
  mountings: readonly Mounting[];
  closures: readonly Closure[];
}): JSX.Element {
  const nights = timeline.months.flatMap((month) => month.nights);

  // The nights the chart placed, so a night cannot disagree between views.
  const calendarNights = buildCalendarNights({
    site,
    observingNights: nights.map((night) => night.observingNight),
    holidays: semester.holidays,
    moonEvents: semester.moonEvents,
    bands: timeline.bands,
  });

  const first = calendarNights[0]?.eveningDate;

  if (first === undefined) {
    return (
      <p className="text-sm text-foreground-muted" data-testid="semester-calendar">
        Nothing is recorded for this semester.
      </p>
    );
  }

  return (
    <div className="resource-calendar min-w-0" data-testid="semester-calendar">
      <MonthCalendar
        timeline={timeline}
        nights={nights}
        calendarNights={calendarNights}
        firstEvening={first}
        mountings={mountings}
        closures={closures}
      />
    </div>
  );
}

function MonthCalendar({
  timeline,
  nights,
  calendarNights,
  firstEvening,
  mountings,
  closures,
}: {
  timeline: Timeline;
  nights: readonly TimelineNight[];
  calendarNights: readonly CalendarNight[];
  firstEvening: string;
  mountings: readonly Mounting[];
  closures: readonly Closure[];
}): JSX.Element {
  const byEvening = new Map(calendarNights.map((night) => [night.eveningDate, night]));

  // Bounding the paging: nobody should read an empty grid as a closed telescope (I4).
  const monthStarts = timeline.months.map((month) => new Date(month.year, month.month - 1, 1));

  // The fallback is the semester's first month, which also covers a stale parameter from elsewhere.
  const firstMonthKey = monthKeyOf(monthStarts[0] ?? localDateOf(firstEvening));
  const [monthParam, setMonthParam] = useUrlParam('month', firstMonthKey);
  const date =
    monthStarts.find((start) => monthKeyOf(start) === monthParam) ?? monthStarts[0] ?? localDateOf(firstEvening);

  const monthIndexOf = (value: Date): number =>
    monthStarts.findIndex(
      (start) => start.getFullYear() === value.getFullYear() && start.getMonth() === value.getMonth(),
    );

  const handleNavigate = (next: Date): void => {
    const index = monthIndexOf(next);
    const clamped = index === -1 ? (next < (monthStarts[0] ?? next) ? monthStarts[0] : monthStarts.at(-1)) : next;
    setMonthParam(monthKeyOf(clamped ?? next));
  };

  // The chips are semester-wide facts; react-big-calendar shows the month's.
  const events = buildEvents(nights, mountings, closures);

  const openNightView = useOpenNight();
  const openNight = (evening: string): void => {
    if (byEvening.has(evening)) {
      openNightView(addDays(evening, 1));
    }
  };

  const handleSelectSlot = (slot: SlotInfo): void => {
    openNight(isoOf(slot.start));
  };

  const handleSelectEvent = (event: NightEvent): void => {
    openNight(event.firstEvening);
  };

  const handleDrillDown = (value: Date): void => {
    openNight(isoOf(value));
  };

  // The title is the picker: every month is one jump away, not a chain of prev-clicks.
  const monthOptions = timeline.months.map((month) => ({
    label: month.label,
    value: `${month.year}-${pad(month.month)}`,
  }));

  const components = {
    // dayPropGetter applies only className and style, so the wrapper clones the cell to carry a title.
    dateCellWrapper: (wrapper: DateCellWrapperProps) => {
      const night = byEvening.get(isoOf(wrapper.value));
      return night === undefined ? wrapper.children : cloneElement(wrapper.children, { title: describeNight(night) });
    },
    toolbar: (toolbar: ToolbarProps<NightEvent>) => {
      const index = monthIndexOf(toolbar.date);
      return (
        <div className="mb-2 flex items-center justify-between gap-2">
          <Button
            text
            size="small"
            aria-label="Previous month"
            disabled={index <= 0}
            onClick={() => {
              toolbar.onNavigate('PREV');
            }}
          >
            <ChevronLeft />
          </Button>
          <Dropdown
            value={monthKeyOf(toolbar.date)}
            options={monthOptions}
            onChange={(event) => {
              toolbar.onNavigate('DATE', localDateOf(`${String(event.value)}-01`));
            }}
            aria-label="Month"
            className="w-52"
          />
          <Button
            text
            size="small"
            aria-label="Next month"
            disabled={index === -1 || index >= monthStarts.length - 1}
            onClick={() => {
              toolbar.onNavigate('NEXT');
            }}
          >
            <ChevronRight />
          </Button>
        </div>
      );
    },
    month: {
      dateHeader: (header: DateHeaderProps) => {
        const night = byEvening.get(isoOf(header.date));
        if (night === undefined) {
          return <span className="px-1 text-[0.7rem] text-foreground-muted opacity-50">{header.label.trim()}</span>;
        }
        return (
          <button
            type="button"
            className="block w-full cursor-pointer px-1 pt-0.5 text-left"
            title={describeNight(night)}
            aria-label={`Open night beginning ${night.eveningDate}`}
            onClick={header.onDrillDown}
          >
            <span className="flex items-center justify-between gap-1">
              <span className="text-[0.72rem] font-semibold tabular-nums">{header.label.trim()}</span>
              <span className="flex items-center gap-1">
                {night.publishedMoon !== null && (
                  <span className="text-[0.55rem] font-semibold tracking-wide uppercase opacity-80">
                    {night.publishedMoon === 'NEW' ? 'new' : 'full'}
                  </span>
                )}
                <MoonDisc phase={night.moon} size={12} className="shrink-0" />
              </span>
            </span>
            <span className="flex items-baseline justify-between gap-1 text-[0.6rem] text-foreground-muted">
              <span>{night.darkHours === null ? '' : `${night.darkHours.toFixed(1)} h`}</span>
              {night.isHoliday && <span className="font-semibold text-amber-300">holiday</span>}
            </span>
          </button>
        );
      },
    },
  };

  return (
    <Calendar<NightEvent>
      localizer={localizer}
      // Inline, not stylesheet: the height decides the week-row geometry and the tests load no global.css.
      style={{ height: '44rem' }}
      date={date}
      onNavigate={handleNavigate}
      view="month"
      views={['month']}
      events={events}
      components={components}
      // Every chip renders: a "+N more" fold would hide sparse facts and drag in RBC's height measurement.
      showAllEvents
      selectable
      longPressThreshold={10}
      onSelectSlot={handleSelectSlot}
      onSelectEvent={handleSelectEvent}
      onDrillDown={handleDrillDown}
      tooltipAccessor={(event) => event.tooltip}
      eventPropGetter={(event) => ({
        style: { backgroundColor: event.color, color: event.ink },
      })}
      dayPropGetter={(value) => {
        const night = byEvening.get(isoOf(value));
        return night === undefined
          ? { className: 'night-outside' }
          : {
              className: [
                'night-clickable',
                `night-${night.brightness.toLowerCase()}`,
                ...(night.isHoliday ? ['night-holiday'] : []),
                ...(night.closed ? ['night-closed'] : []),
              ].join(' '),
            };
      }}
    />
  );
}
