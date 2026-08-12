/**
 * Shared Apollo cache configuration for the app and the browser-test client, so
 * tests exercise the same normalization behaviour production uses.
 *
 * ## Block objects are contextual values, not shared entities
 *
 * Every availability query clips its blocks to the interval asked for, under
 * the block's stable id. Left to normalize by id, one response clobbers
 * another's intervals: step the night view to the 13th, come back to tonight,
 * and tonight's cache hit re-reads blocks clipped to the 13th - an empty chart
 * and "no components tonight" on a night that is fully scheduled. That is not
 * a mock quirk; the ODB contract clips the same way. `keyFields: false` stores
 * the blocks inside each query result instead of by id, so a window can never
 * poison another window's answer.
 *
 * `Component` stays normalized: it is a true entity - identity only, no
 * window-dependent fields.
 */
import { InMemoryCache } from '@apollo/client';

export const buildCache = (): InMemoryCache =>
  new InMemoryCache({
    typePolicies: {
      InstrumentAvailabilityBlock: { keyFields: false },
      TelescopeAvailabilityBlock: { keyFields: false },
      InstrumentComponentAvailabilityBlock: { keyFields: false },
    },
  });
