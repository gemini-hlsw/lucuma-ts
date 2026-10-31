import { InMemoryCache } from '@apollo/client';

/** Held by hand until the backend gives the block types a shared `ResourceBlock` interface to key on. */
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
