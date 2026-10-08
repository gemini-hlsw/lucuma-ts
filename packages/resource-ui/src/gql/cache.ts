import { InMemoryCache } from '@apollo/client';

/** Every `…Block` type in the schema, kept by hand: no test holds the list to it. */
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
