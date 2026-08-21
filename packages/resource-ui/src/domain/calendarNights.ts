/**
 * A semester's blocks -> what is true of each *night*, which is what a calendar
 * square holds.
 *
 * ## Why this exists and the chart does not need it
 *
 * The chart is a run view: which instrument was on which port, over what span.
 * It cannot say anything about a night itself. A calendar's
 * unit is the night, so it needs the facts that vary night to night and that
 * nothing else in the product carries - the moon, the length of darkness, and
 * whether the date is a holiday.
 *
 * ## What is honest here and what is approximate
 *
 * - **Holidays are published data.** The sheet paints them and the importer now
 *   reads them; nothing is inferred.
 * - **Dark hours are astronomical night** - sun below -18 degrees - not moonless
 *   time. We have no moonrise or moonset, so "dark" here means the sun is down,
 *   and a full moon riding high still counts. That is a real limitation and the
 *   label says so rather than implying we know better.
 * - **Brightness is phase only, from a mean-synodic approximation** (see
 *   `moon.ts`, accurate to about half a day). It is a reading aid, not a
 *   scheduling input, which is why the published new and full dates are shown
 *   alongside it rather than replaced by it.
 */
import { type MoonPhase, moonPhaseAt } from './moon';
import { addDays } from './semester';
import { observingNightInterval } from './siteTime';
import { nightSunTimes } from './sun';
import type { MoonEvent, Site } from './types';

/**
 * How much the moon is likely to hurt.
 *
 * The usual three-way split used for planning. Phase only: a bright moon that
 * has set is still counted bright here, which is the limitation named above.
 */
export type LunarBrightness = 'DARK' | 'GREY' | 'BRIGHT';

const DARK_BELOW = 0.25;
const BRIGHT_ABOVE = 0.65;

export const brightnessOf = (fraction: number): LunarBrightness =>
  fraction < DARK_BELOW ? 'DARK' : fraction > BRIGHT_ABOVE ? 'BRIGHT' : 'GREY';

export interface CalendarNight {
  /** The evening the night begins, which is what the calendar square is headed by. */
  readonly eveningDate: string;
  /** The observing night, labelled by the morning it ends on. */
  readonly observingNight: string;
  readonly isHoliday: boolean;
  readonly moon: MoonPhase;
  readonly brightness: LunarBrightness;
  /** New or full, when the sheet prints one against this date. */
  readonly publishedMoon: MoonEvent['phase'] | null;
  /** Hours of astronomical night; null when the sun never clears -18 degrees. */
  readonly darkHours: number | null;
  /** True when a telescope-wide closure covers the night. */
  readonly closed: boolean;
  /** The closure's printed reason, when there is one. */
  readonly closureReason: string | null;
}

const MS_PER_HOUR = 3_600_000;

/** Astronomical night in hours, or null when the sun never gets far enough down. */
export const darkHoursOf = (site: Site, observingNight: string): number | null => {
  const { duskAstronomical, dawnAstronomical } = nightSunTimes(site, observingNightInterval(site, observingNight));
  return duskAstronomical === null || dawnAstronomical === null
    ? null
    : (dawnAstronomical - duskAstronomical) / MS_PER_HOUR;
};

export interface BuildCalendarNightsOptions {
  readonly site: Site;
  /** Observing nights, in order. */
  readonly observingNights: readonly string[];
  readonly holidays: readonly string[];
  readonly moonEvents: readonly MoonEvent[];
  readonly bands: readonly { readonly interval: { start: number; end: number }; readonly label: string }[];
}

/** Builds one entry per night. */
export const buildCalendarNights = ({
  site,
  observingNights,
  holidays,
  moonEvents,
  bands,
}: BuildCalendarNightsOptions): readonly CalendarNight[] => {
  const holidaySet = new Set(holidays);
  const publishedMoon = new Map(moonEvents.map((event) => [event.date, event.phase]));

  return observingNights.map((observingNight) => {
    const eveningDate = addDays(observingNight, -1);
    const interval = observingNightInterval(site, observingNight);
    // Sampled at the middle of the night rather than at either boundary, so the
    // phase belongs to the night the square names.
    const moon = moonPhaseAt((interval.start + interval.end) / 2);

    const band = bands.find((entry) => entry.interval.start < interval.end && interval.start < entry.interval.end);
    const closed = band !== undefined;

    return {
      eveningDate,
      observingNight,
      isHoliday: holidaySet.has(eveningDate),
      moon,
      brightness: brightnessOf(moon.fraction),
      publishedMoon: publishedMoon.get(eveningDate) ?? null,
      darkHours: darkHoursOf(site, observingNight),
      closed,
      closureReason: band?.label ?? null,
    };
  });
};
