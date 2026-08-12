/**
 * Hooks that return **domain models**, never raw fragments.
 *
 * Components consume these; nothing outside `src/gql` and `src/domain/adapters`
 * sees a generated shape.
 */
import { useQuery } from '@apollo/client/react';

import {
  type NightComponents,
  toClosures,
  toComponentBlocks,
  toComponents,
  toModeBlocks,
  toMountings,
  toNightComponents,
  toPublishedSemesters,
  toSubsystemBlocks,
  toTooBlocks,
} from '@/domain/adapters';
import type {
  Closure,
  ComponentBlock,
  ComponentRecord,
  Interval,
  ModeBlock,
  Mounting,
  PublishedSemester,
  Site,
  SubsystemBlock,
  TooBlock,
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

/** Every site + semester Resource holds, for the picker. */
export const usePublishedSemesters = (): PublishedSemestersResult => {
  const { data, loading, error } = useQuery(PUBLISHED_SEMESTERS_QUERY);
  const semesters = data === undefined ? [] : toPublishedSemesters(data);
  return { semesters, loading, error };
};

export interface ScheduleResult {
  readonly mountings: readonly Mounting[];
  readonly closures: readonly Closure[];
  /** ToO support and telescope mode records over the window, unclipped. */
  readonly tooBlocks: readonly TooBlock[];
  readonly modeBlocks: readonly ModeBlock[];
  readonly loading: boolean;
  readonly error: Error | undefined;
}

/** An interval as the API takes it: ISO instants, not epoch millis. */
export interface ApiInterval {
  readonly start: string;
  readonly end: string;
}

/** The API's interval input, from the domain's epoch-millis one. */
export const toApiInterval = (interval: Interval): ApiInterval => ({
  start: new Date(interval.start).toISOString(),
  end: new Date(interval.end).toISOString(),
});

const EMPTY_INTERVAL: ApiInterval = { start: '', end: '' };

/**
 * Every record a semester view draws, in one response.
 *
 * `skip` covers the first render, before the picker has resolved which semester
 * is being shown.
 */
export const useSemesterSchedule = (site: Site, bounds: ApiInterval | null): ScheduleResult => {
  const { data, loading, error } = useQuery(SEMESTER_SCHEDULE_QUERY, {
    variables: { site, interval: bounds ?? EMPTY_INTERVAL },
    skip: bounds === null,
  });

  const mountings = toMountings(data?.instrumentAvailability ?? []);
  const closures = toClosures(data?.telescopeAvailability ?? []);
  const tooBlocks = toTooBlocks(data?.tooSupport ?? []);
  const modeBlocks = toModeBlocks(data?.telescopeMode ?? []);
  return { mountings, closures, tooBlocks, modeBlocks, loading, error };
};

export interface NightScheduleResult extends ScheduleResult {
  /**
   * False when Resource holds nothing at all for this night.
   *
   * Undefined until the answer arrives, so a loading night is never drawn as an
   * empty one. Only the API can tell "not entered" from "nothing available".
   */
  readonly dataAvailable: boolean | undefined;
  /** The night's interval as the API resolved it, for checking against ours. */
  readonly apiInterval: ApiInterval | undefined;
  /** The component records the night projection carries, clipped to the night. */
  readonly nightComponents: NightComponents;
  /** Subsystem records over the night - PWFS1, PWFS2, LGS from the workbook. */
  readonly subsystemBlocks: readonly SubsystemBlock[];
}

const NO_COMPONENTS: NightComponents = { components: [], blocks: [] };

/** One night: its records, and whether anything is recorded for it at all. */
export const useNightSchedule = (site: Site, observingNight: string, bounds: ApiInterval): NightScheduleResult => {
  const { data, loading, error } = useQuery(NIGHT_SCHEDULE_QUERY, {
    variables: { site, night: observingNight, interval: bounds },
  });

  const mountings = toMountings(data?.instrumentAvailability ?? []);
  const closures = toClosures(data?.telescopeAvailability ?? []);
  const tooBlocks = toTooBlocks(data?.tooSupport ?? []);
  const modeBlocks = toModeBlocks(data?.telescopeMode ?? []);
  const subsystemBlocks = toSubsystemBlocks(data?.telescopeSubsystemAvailability ?? []);
  const nightComponents = data === undefined ? NO_COMPONENTS : toNightComponents(data.telescopeNight.components);
  return {
    mountings,
    closures,
    loading,
    error,
    dataAvailable: data?.telescopeNight.dataAvailable,
    apiInterval: data?.telescopeNight.interval,
    tooBlocks,
    modeBlocks,
    subsystemBlocks,
    nightComponents,
  };
};

export interface WeekScheduleResult extends ScheduleResult {
  /** Which of the week's nights Resource holds anything for. */
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
    variables: { site, nights, interval: bounds },
  });

  const mountings = toMountings(data?.instrumentAvailability ?? []);
  const closures = toClosures(data?.telescopeAvailability ?? []);
  const tooBlocks = toTooBlocks(data?.tooSupport ?? []);
  const modeBlocks = toModeBlocks(data?.telescopeMode ?? []);
  const nightsWithData = new Set(
    (data?.telescopeNights ?? []).filter((night) => night.dataAvailable).map((night) => night.observingNight),
  );
  const nightComponents = data === undefined ? NO_COMPONENTS : toNightComponents(data.instrumentComponentAvailability);

  return {
    mountings,
    closures,
    tooBlocks,
    modeBlocks,
    loading,
    error,
    nightsWithData,
    nightsResolved: data !== undefined,
    nightComponents,
  };
};

export interface ComponentBrowserResult {
  readonly components: readonly ComponentRecord[];
  readonly componentBlocks: readonly ComponentBlock[];
  readonly mountings: readonly Mounting[];
  readonly loading: boolean;
  readonly error: Error | undefined;
}

/**
 * The component browser's one round trip: catalog, records over the window, and
 * the mountings that resolve INSTALLED to a physical place.
 */
export const useComponentBrowser = (site: Site, interval: ApiInterval | null): ComponentBrowserResult => {
  const { data, loading, error } = useQuery(COMPONENT_BROWSER_QUERY, {
    variables: { site, interval: interval ?? EMPTY_INTERVAL },
    skip: interval === null,
  });

  const components = data === undefined ? [] : toComponents(data);
  const componentBlocks = data === undefined ? [] : toComponentBlocks(data);
  const mountings = data === undefined ? [] : toMountings(data.instrumentAvailability);

  return { components, componentBlocks, mountings, loading, error };
};
