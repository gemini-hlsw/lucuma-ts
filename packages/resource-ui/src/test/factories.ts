import type {
  TelescopeAvailability,
  TelescopeAvailabilityStatus,
  TelescopeModeStatus,
  TelescopeModeType,
  TelescopeNightTimeline,
  TelescopeTooStatus,
  TimeSpan,
  TimestampInterval,
  TooSupport,
} from '@/types';

import type { TimelineBlock, TimelineRowData } from '../features/tonight/types';

const defaultDuration: TimeSpan = {
  __typename: 'TimeSpan',
  iso: 'PT2H30M',
  seconds: 9000,
};

const createInterval = (start: string, end: string, duration: TimeSpan = defaultDuration): TimestampInterval => ({
  __typename: 'TimestampInterval',
  start,
  end,
  duration,
});

const createModeStatus = (
  type: TelescopeModeType,
  start: string,
  end: string,
  programReference: string | null = null,
): TelescopeModeStatus => ({
  __typename: 'TelescopeModeStatus',
  site: 'GN',
  interval: createInterval(start, end),
  mode: {
    __typename: 'TelescopeMode',
    type,
    programReference,
  },
});

const createAvailabilityStatus = (
  availability: TelescopeAvailability,
  start: string,
  end: string,
): TelescopeAvailabilityStatus => ({
  __typename: 'TelescopeAvailabilityStatus',
  site: 'GN',
  interval: createInterval(start, end),
  availability,
  reason: null,
  plannedAvailability: null,
});

const createTooStatus = (tooSupport: TooSupport, start: string, end: string): TelescopeTooStatus => ({
  __typename: 'TelescopeTooStatus',
  site: 'GN',
  interval: createInterval(start, end),
  tooSupport,
});

export const createTelescopeNightTimeline = (
  overrides: Partial<TelescopeNightTimeline> = {},
): TelescopeNightTimeline => ({
  __typename: 'TelescopeNightTimeline',
  site: 'GN',
  observingNight: '2026-08-01',
  displayInterval: createInterval('2026-08-01T19:00:00-10:00', '2026-08-02T08:00:00-10:00'),
  modes: [],
  availability: [],
  tooStatus: [],
  ...overrides,
});

export const createTimelineBlock = (overrides: Partial<TimelineBlock> = {}): TimelineBlock => ({
  id: 'mode-0-2026-08-01T19:00:00-10:00',
  interval: createInterval('2026-08-01T19:00:00-10:00', '2026-08-01T21:30:00-10:00'),
  label: 'QUEUE',
  variant: 'queue',
  ...overrides,
});

export const createTimelineRow = (overrides: Partial<TimelineRowData> = {}): TimelineRowData => ({
  id: 'mode',
  label: 'MODE',
  blocks: [createTimelineBlock()],
  ...overrides,
});

export const timelineFactory = {
  interval: createInterval,
  modeStatus: createModeStatus,
  availabilityStatus: createAvailabilityStatus,
  tooStatus: createTooStatus,
  block: createTimelineBlock,
  row: createTimelineRow,
};
