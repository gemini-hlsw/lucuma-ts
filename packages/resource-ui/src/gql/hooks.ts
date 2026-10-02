import { useQuery } from '@apollo/client/react';

import {
  type NightComponents,
  toComponentAvailability,
  toComponents,
  toInstrumentAvailability,
  toNightComponents,
  toPublishedSemesters,
  toTelescopeAvailability,
  toTelescopeMode,
  toTelescopeSubsystemAvailability,
  toTooSupport,
} from '@/domain/adapters';
import type {
  InstrumentAvailabilityBlock,
  InstrumentComponent,
  InstrumentComponentAvailabilityBlock,
  Interval,
  PublishedSemester,
  Site,
  TelescopeAvailabilityBlock,
  TelescopeModeBlock,
  TelescopeSubsystemAvailabilityBlock,
  TooSupportBlock,
} from '@/domain/types';

import {
  COMPONENT_BROWSER_QUERY,
  NIGHT_SCHEDULE_QUERY,
  PUBLISHED_SEMESTERS_QUERY,
  SEMESTER_SCHEDULE_QUERY,
  WEEK_SCHEDULE_QUERY,
} from './resource';

export interface PublishedSemestersResult {
  readonly semesters: readonly PublishedSemester[];
  readonly loading: boolean;
  readonly error: Error | undefined;
}

/** The four lists every schedule query selects. Typed off the adapters, so a signature change lands here. */
const toSchedule = (
  data:
    | {
        readonly instrumentAvailability?: Parameters<typeof toInstrumentAvailability>[0];
        readonly telescopeAvailability?: Parameters<typeof toTelescopeAvailability>[0];
        readonly tooSupport?: Parameters<typeof toTooSupport>[0];
        readonly telescopeMode?: Parameters<typeof toTelescopeMode>[0];
      }
    | undefined,
): Pick<ScheduleResult, 'instrumentAvailability' | 'telescopeAvailability' | 'tooSupport' | 'telescopeMode'> => ({
  instrumentAvailability: toInstrumentAvailability(data?.instrumentAvailability ?? []),
  telescopeAvailability: toTelescopeAvailability(data?.telescopeAvailability ?? []),
  tooSupport: toTooSupport(data?.tooSupport ?? []),
  telescopeMode: toTelescopeMode(data?.telescopeMode ?? []),
});

/** Every site + semester Resource holds, for the picker. */
export const usePublishedSemesters = (): PublishedSemestersResult => {
  const { data, loading, error } = useQuery(PUBLISHED_SEMESTERS_QUERY);
  const semesters = data === undefined ? [] : toPublishedSemesters(data);
  return { semesters, loading, error };
};

export interface ScheduleResult {
  readonly instrumentAvailability: readonly InstrumentAvailabilityBlock[];
  readonly telescopeAvailability: readonly TelescopeAvailabilityBlock[];
  /** ToO support and telescope mode records over the window, unclipped. */
  readonly tooSupport: readonly TooSupportBlock[];
  readonly telescopeMode: readonly TelescopeModeBlock[];
  readonly loading: boolean;
  readonly error: Error | undefined;
}

/** An interval as the API takes it: ISO instants, not epoch millis. */
export interface ApiInterval {
  readonly start: string;
  readonly end: string;
}

export const toApiInterval = (interval: Interval): ApiInterval => ({
  start: new Date(interval.start).toISOString(),
  end: new Date(interval.end).toISOString(),
});

const EMPTY_INTERVAL: ApiInterval = { start: '', end: '' };

/** `skip` covers the first render, before the picker has resolved which semester is shown. */
export const useSemesterSchedule = (site: Site, bounds: ApiInterval | null): ScheduleResult => {
  const { data, loading, error } = useQuery(SEMESTER_SCHEDULE_QUERY, {
    variables: { site, ...(bounds ?? EMPTY_INTERVAL) },
    skip: bounds === null,
  });

  const { instrumentAvailability, telescopeAvailability, tooSupport, telescopeMode } = toSchedule(data);
  return { instrumentAvailability, telescopeAvailability, tooSupport, telescopeMode, loading, error };
};

export interface NightScheduleResult extends ScheduleResult {
  /** Undefined until the answer arrives, so a loading night is never drawn as an empty one. */
  readonly dataAvailable: boolean | undefined;
  /** The night's interval as the API resolved it, for checking against ours. */
  readonly apiInterval: ApiInterval | undefined;
  /** Subsystem records over the night - PWFS1, PWFS2, LGS from the workbook. */
  readonly telescopeSubsystemAvailability: readonly TelescopeSubsystemAvailabilityBlock[];
}

const NO_COMPONENTS: NightComponents = { components: [], blocks: [] };

/** One night: its records, and whether anything is recorded for it at all. */
export const useNightSchedule = (site: Site, observingNight: string, bounds: ApiInterval): NightScheduleResult => {
  const { data, loading, error } = useQuery(NIGHT_SCHEDULE_QUERY, {
    variables: { site, night: observingNight, ...bounds },
  });

  const { instrumentAvailability, telescopeAvailability, tooSupport, telescopeMode } = toSchedule(data);
  const telescopeSubsystemAvailability = toTelescopeSubsystemAvailability(data?.telescopeSubsystemAvailability ?? []);
  return {
    instrumentAvailability,
    telescopeAvailability,
    loading,
    error,
    dataAvailable: data?.telescopeNight.dataAvailable,
    apiInterval: data?.telescopeNight.interval,
    tooSupport,
    telescopeMode,
    telescopeSubsystemAvailability,
  };
};

export interface WeekScheduleResult extends ScheduleResult {
  readonly nightsWithData: ReadonlySet<string>;
  /** Whether the answer has arrived, so an empty set is not read as "none". */
  readonly nightsResolved: boolean;
  /** Component records over the window, for the briefing's changes list. */
  readonly nightComponents: NightComponents;
}

/** A week of nights: the runs crossing them, and which nights are entered. */
export const useWeekSchedule = (
  site: Site,
  nights: { readonly start: string; readonly end: string },
  bounds: ApiInterval,
): WeekScheduleResult => {
  const { data, loading, error } = useQuery(WEEK_SCHEDULE_QUERY, {
    variables: { site, nightsStart: nights.start, nightsEnd: nights.end, ...bounds },
  });

  const { instrumentAvailability, telescopeAvailability, tooSupport, telescopeMode } = toSchedule(data);
  const nightsWithData = new Set(
    (data?.telescopeNights ?? []).filter((night) => night.dataAvailable).map((night) => night.observingNight),
  );
  const nightComponents = data === undefined ? NO_COMPONENTS : toNightComponents(data.instrumentComponentAvailability);

  return {
    instrumentAvailability,
    telescopeAvailability,
    tooSupport,
    telescopeMode,
    loading,
    error,
    nightsWithData,
    nightsResolved: data !== undefined,
    nightComponents,
  };
};

export interface ComponentBrowserResult {
  readonly components: readonly InstrumentComponent[];
  readonly componentAvailability: readonly InstrumentComponentAvailabilityBlock[];
  readonly instrumentAvailability: readonly InstrumentAvailabilityBlock[];
  readonly loading: boolean;
  readonly error: Error | undefined;
}

/** One round trip: catalog, records over the window, and the instrument blocks INSTALLED resolves against. */
export const useComponentBrowser = (site: Site, interval: ApiInterval | null): ComponentBrowserResult => {
  const { data, loading, error } = useQuery(COMPONENT_BROWSER_QUERY, {
    variables: { site, ...(interval ?? EMPTY_INTERVAL) },
    skip: interval === null,
  });

  const components = data === undefined ? [] : toComponents(data);
  const componentAvailability = data === undefined ? [] : toComponentAvailability(data);
  const instrumentAvailability = data === undefined ? [] : toInstrumentAvailability(data.instrumentAvailability);

  return { components, componentAvailability, instrumentAvailability, loading, error };
};
