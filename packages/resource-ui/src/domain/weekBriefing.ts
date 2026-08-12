/**
 * What to expect this week - the facts the seven-night chart cannot carry.
 *
 * The published schedule is whole-night granular and changes maybe twice a
 * month, so seven nights of it are usually seven identical columns. What makes
 * one week different from the next is the sky and the changes, and both are
 * already in hand: the sun and moon are derived, holidays and the printed moon
 * dates are imported, and every change is a block boundary falling inside the
 * window.
 *
 * The same honesty rules as the calendar (calendarNights.ts): dark hours are
 * astronomical night, not moonless time, and brightness is phase-only from the
 * mean-synodic approximation. Reading aids, not scheduling inputs.
 */
import { brightnessOf, darkHoursOf, type LunarBrightness } from './calendarNights';
import { type MoonPhase, moonPhaseAt } from './moon';
import type { TimelineNight } from './timeline';
import type {
  Closure,
  ComponentBlock,
  ComponentPlace,
  ComponentRecord,
  ComponentUsage,
  Interval,
  MoonEvent,
  Mounting,
  Site,
} from './types';

/** One night's briefing entry: the sky, and whether anything is recorded. */
export interface WeekNightFacts {
  readonly observingNight: string;
  /** The evening the night begins on - what the chart heads the column with. */
  readonly eveningDate: string;
  readonly isWeekend: boolean;
  readonly isHoliday: boolean;
  readonly moon: MoonPhase;
  readonly brightness: LunarBrightness;
  /** New or full, when the published sheet prints one against this evening. */
  readonly publishedMoon: MoonEvent['phase'] | null;
  /** Hours of astronomical night; null when the sun never clears -18 degrees. */
  readonly darkHours: number | null;
  readonly dataAvailable: boolean;
}

export interface BuildWeekNightFactsOptions {
  readonly site: Site;
  /** The week timeline's own nights, so the strip and the chart cannot disagree. */
  readonly nights: readonly TimelineNight[];
  readonly holidays: readonly string[];
  readonly moonEvents: readonly MoonEvent[];
}

export const buildWeekNightFacts = ({
  site,
  nights,
  holidays,
  moonEvents,
}: BuildWeekNightFactsOptions): readonly WeekNightFacts[] => {
  const holidaySet = new Set(holidays);
  const publishedMoon = new Map(moonEvents.map((event) => [event.date, event.phase]));

  return nights.map((night) => {
    // Sampled mid-night, same as the calendar, so the phase belongs to the
    // night the column names.
    const moon = moonPhaseAt((night.interval.start + night.interval.end) / 2);
    return {
      observingNight: night.observingNight,
      eveningDate: night.eveningDate,
      isWeekend: night.isWeekend,
      isHoliday: holidaySet.has(night.eveningDate),
      moon,
      brightness: brightnessOf(moon.fraction),
      publishedMoon: publishedMoon.get(night.eveningDate) ?? null,
      darkHours: darkHoursOf(site, night.observingNight),
      dataAvailable: night.dataAvailable,
    };
  });
};

/** The header's one-glance numbers: total dark, and where the moon is going. */
export interface WeekSummary {
  /** Sum over the nights that have an astronomical night at all. */
  readonly totalDarkHours: number;
  readonly moonStart: MoonPhase;
  readonly moonEnd: MoonPhase;
}

export const summarizeWeek = (facts: readonly WeekNightFacts[]): WeekSummary | null => {
  const first = facts[0];
  const last = facts.at(-1);
  if (first === undefined || last === undefined) {
    return null;
  }
  return {
    totalDarkHours: facts.reduce((sum, fact) => sum + (fact.darkHours ?? 0), 0),
    moonStart: first.moon,
    moonEnd: last.moon,
  };
};

/**
 * Something becoming true partway through the week. A boundary exactly at the
 * window's edge is not a change - a run that began last week merely continues.
 */
export type WeekChange =
  | {
      readonly kind: 'RUN_BEGINS' | 'RUN_ENDS';
      readonly instant: number;
      /** The run's published name, e.g. "Maroon-X Run". */
      readonly label: string;
      readonly rowLabel: string;
      readonly note: string | null;
    }
  | {
      readonly kind: 'CLOSURE_BEGINS' | 'CLOSURE_ENDS';
      readonly instant: number;
      /** The printed reason, or a plain statement when the sheet gave none. */
      readonly label: string;
      /** Null when the whole telescope closes rather than one port. */
      readonly rowLabel: string | null;
    }
  | {
      readonly kind: 'COMPONENT';
      readonly instant: number;
      readonly component: ComponentRecord;
      /** The state the piece enters at this instant. */
      readonly place: ComponentPlace;
      readonly usage: ComponentUsage;
      readonly note: string | null;
    };

export interface BuildWeekChangesOptions {
  readonly interval: Interval;
  readonly mountings: readonly Mounting[];
  readonly closures: readonly Closure[];
  readonly componentBlocks: readonly ComponentBlock[];
  readonly components: readonly ComponentRecord[];
}

/**
 * Every boundary strictly inside the week, oldest first.
 *
 * A component's record ending with nothing after it is deliberately not
 * phrased: "nothing recorded" is not a state a change can announce (I4). The
 * change that is announced is always the state something enters.
 */
export const buildWeekChanges = ({
  interval,
  mountings,
  closures,
  componentBlocks,
  components,
}: BuildWeekChangesOptions): readonly WeekChange[] => {
  const inside = (instant: number): boolean => instant > interval.start && instant < interval.end;
  const changes: WeekChange[] = [];

  for (const mounting of mountings) {
    if (inside(mounting.interval.start)) {
      changes.push({
        kind: 'RUN_BEGINS',
        instant: mounting.interval.start,
        label: mounting.publishedName,
        rowLabel: mounting.rowLabel,
        note: mounting.note,
      });
    }
    if (inside(mounting.interval.end)) {
      changes.push({
        kind: 'RUN_ENDS',
        instant: mounting.interval.end,
        label: mounting.publishedName,
        rowLabel: mounting.rowLabel,
        note: null,
      });
    }
  }

  for (const closure of closures) {
    // The availability records also carry the explicit Open spans; only a
    // closure beginning or ending is a change worth listing.
    if (closure.availability !== 'CLOSED') {
      continue;
    }
    const label = closure.reason ?? (closure.port === null ? 'Telescope closed' : 'Closed');
    const rowLabel = closure.port === null ? null : `Port ${closure.port}`;
    if (inside(closure.interval.start)) {
      changes.push({ kind: 'CLOSURE_BEGINS', instant: closure.interval.start, label, rowLabel });
    }
    if (inside(closure.interval.end)) {
      changes.push({ kind: 'CLOSURE_ENDS', instant: closure.interval.end, label, rowLabel });
    }
  }

  const byId = new Map(components.map((component) => [component.id, component]));
  for (const block of componentBlocks) {
    const component = byId.get(block.componentId);
    if (component !== undefined && inside(block.interval.start)) {
      changes.push({
        kind: 'COMPONENT',
        instant: block.interval.start,
        component,
        place: block.place,
        usage: block.usage,
        note: block.note,
      });
    }
  }

  return changes.sort((a, b) => a.instant - b.instant);
};
