import { skipToken, useQuery } from '@apollo/client/react';
import { isNullish } from '@gemini-hlsw/lucuma-common-ui';
import type {
  InstrumentAvailabilityBlockItem,
  ScheduleSpan,
  TelescopeAvailabilityBlockItem,
  TelescopeModeBlockItem,
  TimestampIntervalItem,
  TooSupportBlockItem,
} from '@gql/types';

import {
  toComponentAvailability,
  toComponents,
  toInstrumentAvailability,
  toPublishedSemesters,
  toTelescopeAvailability,
  toTelescopeMode,
  toTooSupport,
} from '@/domain/adapters';
import type {
  InstrumentAvailabilityBlock,
  InstrumentComponent,
  InstrumentComponentAvailabilityBlock,
  PublishedSemester,
  Schedule,
  Site,
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

/** The four lists every schedule query selects. */
const toSchedule = (
  data:
    | {
        readonly instrumentAvailability?: readonly InstrumentAvailabilityBlockItem[];
        readonly telescopeAvailability?: readonly TelescopeAvailabilityBlockItem[];
        readonly tooSupport?: readonly TooSupportBlockItem[];
        readonly telescopeMode?: readonly TelescopeModeBlockItem[];
      }
    | undefined,
): Schedule => ({
  instrumentAvailability: toInstrumentAvailability(data?.instrumentAvailability ?? []),
  telescopeAvailability: toTelescopeAvailability(data?.telescopeAvailability ?? []),
  tooSupport: toTooSupport(data?.tooSupport ?? []),
  telescopeMode: toTelescopeMode(data?.telescopeMode ?? []),
});

/** Every site + semester Resource holds, for the picker. */
export const usePublishedSemesters = (): PublishedSemestersResult => {
  const { data, loading, error } = useQuery(PUBLISHED_SEMESTERS_QUERY);
  const semesters = data === undefined ? [] : toPublishedSemesters(data.publishedSemesters);
  return { semesters, loading, error };
};

export interface ScheduleResult {
  /** The window's records, unclipped. */
  readonly schedule: Schedule;
  readonly loading: boolean;
  readonly error: Error | undefined;
}

/** `skip` covers the first render, before the picker has resolved which semester is shown. */
export const useSemesterSchedule = (site: Site, bounds: ScheduleSpan | null): ScheduleResult => {
  const { data, loading, error } = useQuery(
    SEMESTER_SCHEDULE_QUERY,
    isNullish(bounds)
      ? skipToken
      : {
          variables: { site, ...bounds },
        },
  );

  return { schedule: toSchedule(data), loading, error };
};

export interface NightScheduleResult extends ScheduleResult {
  /** Undefined until the answer arrives, so a loading night is never drawn as an empty one. */
  readonly dataAvailable: boolean | undefined;
  /** The night's interval as the API resolved it, for checking against ours. */
  readonly apiInterval: TimestampIntervalItem | undefined;
}

/** One night: its records, and whether anything is recorded for it at all. */
export const useNightSchedule = (site: Site, observingNight: string, bounds: ScheduleSpan): NightScheduleResult => {
  const { data, loading, error } = useQuery(NIGHT_SCHEDULE_QUERY, {
    variables: { site, night: observingNight, ...bounds },
  });

  return {
    schedule: toSchedule(data),
    loading,
    error,
    dataAvailable: data?.telescopeNight.dataAvailable,
    apiInterval: data?.telescopeNight.interval,
  };
};

export interface WeekScheduleResult extends ScheduleResult {
  readonly nightsWithData: ReadonlySet<string>;
  /** Whether the answer has arrived, so an empty set is not read as "none". */
  readonly nightsResolved: boolean;
}

/** A week of nights: the runs crossing them, and which nights are entered. */
export const useWeekSchedule = (
  site: Site,
  // Observing-night dates, not a Timestamp `ScheduleSpan`; the variables take them apart as `nightsStart` and `nightsEnd`.
  nights: { readonly start: string; readonly end: string },
  bounds: ScheduleSpan,
): WeekScheduleResult => {
  const { data, loading, error } = useQuery(WEEK_SCHEDULE_QUERY, {
    variables: { site, nightsStart: nights.start, nightsEnd: nights.end, ...bounds },
  });

  const nightsWithData = new Set(
    (data?.telescopeNights ?? []).filter((night) => night.dataAvailable).map((night) => night.observingNight),
  );

  return { schedule: toSchedule(data), loading, error, nightsWithData, nightsResolved: data !== undefined };
};

export interface ComponentBrowserResult {
  readonly components: readonly InstrumentComponent[];
  readonly componentAvailability: readonly InstrumentComponentAvailabilityBlock[];
  readonly instrumentAvailability: readonly InstrumentAvailabilityBlock[];
  readonly loading: boolean;
  readonly error: Error | undefined;
}

/** One round trip: catalog, records over the window, and the instrument blocks INSTALLED resolves against. */
export const useComponentBrowser = (site: Site, interval: ScheduleSpan | null): ComponentBrowserResult => {
  const { data, loading, error } = useQuery(
    COMPONENT_BROWSER_QUERY,
    isNullish(interval)
      ? skipToken
      : {
          variables: { site, ...interval },
        },
  );

  const components = data === undefined ? [] : toComponents(data.components);
  const componentAvailability = data === undefined ? [] : toComponentAvailability(data.instrumentComponentAvailability);
  const instrumentAvailability = data === undefined ? [] : toInstrumentAvailability(data.instrumentAvailability);

  return { components, componentAvailability, instrumentAvailability, loading, error };
};
