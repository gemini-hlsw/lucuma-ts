import { type MoonPhase, moonPhaseAt } from './moon';
import { addDays } from './semester';
import { observingNightInterval } from './siteTime';
import { nightSunTimes } from './sun';
import type { MoonEvent, Site } from './types';

/** Phase only: a bright moon that has set is still counted bright. */
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
    // Sampled at the middle of the night, so the phase belongs to the night the square names.
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
