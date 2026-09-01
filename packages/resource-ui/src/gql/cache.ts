import { InMemoryCache } from '@apollo/client';

/** Exactly the `ScheduleBlock` implementors, which is what `cache.test.ts` holds this list to. */
export const CONTEXTUAL_BLOCK_TYPES = [
  'InstrumentAvailabilityBlock',
  'InstrumentComponentAvailabilityBlock',
  'TelescopeAvailabilityBlock',
  'TelescopeModeBlock',
  'TelescopeSubsystemAvailabilityBlock',
  'TooSupportBlock',
] as const;

/** `keyFields: false`: normalizing a block lets one window's answer empty another window's night. */
export const buildCache = (): InMemoryCache =>
  new InMemoryCache({
    typePolicies: Object.fromEntries(
      CONTEXTUAL_BLOCK_TYPES.map((typeName) => [typeName, { keyFields: false }] as const),
    ),
  });
