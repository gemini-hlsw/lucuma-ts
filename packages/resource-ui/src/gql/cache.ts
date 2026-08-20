/**
 * Shared Apollo cache configuration for the app and the browser-test client, so
 * tests exercise the same normalization behaviour production uses.
 *
 * ## Block objects are contextual values, not shared entities
 *
 * Every availability query clips its blocks to the interval asked for, so what
 * comes back is a projection of a record onto a window, not the record. Blocks
 * carried a stable `id` until 2026-08-14 and Apollo normalized on it, which
 * let one response clobber another's intervals: step the night view to the
 * 13th, come back to tonight, and tonight's cache hit re-read blocks clipped
 * to the 13th - an empty chart and "no components tonight" on a night that is
 * fully scheduled.
 *
 * The schema no longer offers an `id` on `ScheduleBlock` (its own docstring
 * says why), so nothing here is normalizable by accident any more. This stays
 * as the second lock: `keyFields: false` on every implementor means a future
 * `id` on one of these types cannot quietly re-enable the bug, and
 * `cache.test.ts` reads the SDL so a new implementor cannot quietly miss the
 * list.
 *
 * `InstrumentComponent` stays normalized, and keeps its `id`: it is a true
 * entity - identity only, no window-dependent fields.
 */
import { InMemoryCache } from '@apollo/client';

/** The `ScheduleBlock` implementors, every one a contextual value. */
export const CONTEXTUAL_BLOCK_TYPES = [
  'InstrumentAvailabilityBlock',
  'InstrumentComponentAvailabilityBlock',
  'TelescopeAvailabilityBlock',
  'TelescopeModeBlock',
  'TelescopeSubsystemAvailabilityBlock',
  'TooSupportBlock',
] as const;

export const buildCache = (): InMemoryCache =>
  new InMemoryCache({
    typePolicies: Object.fromEntries(
      CONTEXTUAL_BLOCK_TYPES.map((typeName) => [typeName, { keyFields: false }] as const),
    ),
  });
