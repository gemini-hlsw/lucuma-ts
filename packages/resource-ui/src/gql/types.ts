import type { SemesterScheduleQueryVariables } from './gen/graphql';

export type {
  DateIntervalItemFragment as DateIntervalItem,
  InstrumentAvailabilityBlockItemFragment as InstrumentAvailabilityBlockItem,
  InstrumentComponentAvailabilityBlockItemFragment as InstrumentComponentAvailabilityBlockItem,
  InstrumentComponentItemFragment as InstrumentComponentItem,
  InstrumentComponentRefFragment as InstrumentComponentRef,
  InstrumentLocationItemFragment as InstrumentLocationItem,
  PublishedSemesterItemFragment as PublishedSemesterItem,
  TelescopeAvailabilityBlockItemFragment as TelescopeAvailabilityBlockItem,
  TelescopeModeBlockItemFragment as TelescopeModeBlockItem,
  TelescopeNightItemFragment as TelescopeNightItem,
  TimestampIntervalItemFragment as TimestampIntervalItem,
  TooSupportBlockItemFragment as TooSupportBlockItem,
} from './gen/graphql';

/** The window every schedule query takes; the client builds it, so it is variables, not a fragment. */
export type ScheduleSpan = Pick<SemesterScheduleQueryVariables, 'start' | 'end'>;
