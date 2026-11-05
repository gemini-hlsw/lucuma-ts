import { describe, expectTypeOf, it } from 'vitest';

import { instrumentAvailabilityBlock, overNights } from './blocks';

const interval = overNights('GN', '2026-08-02', '2026-08-03');

describe(instrumentAvailabilityBlock, () => {
  it('should accept one placement when at names a port or a place', () => {
    expectTypeOf(instrumentAvailabilityBlock({ instrument: 'GNIRS', interval, at: { port: 3 } })).toEqualTypeOf<
      ReturnType<typeof instrumentAvailabilityBlock>
    >();
    expectTypeOf(instrumentAvailabilityBlock({ instrument: 'GNIRS', interval, at: { place: 'LAB' } })).toEqualTypeOf<
      ReturnType<typeof instrumentAvailabilityBlock>
    >();
  });

  it('should not compile when at names both a port and a place', () => {
    // @ts-expect-error a port and a place are exclusive
    instrumentAvailabilityBlock({ instrument: 'GNIRS', interval, at: { port: 3, place: 'LAB' } });
  });

  it('should not compile when at is absent', () => {
    // @ts-expect-error the placement is required
    instrumentAvailabilityBlock({ instrument: 'GNIRS', interval });
  });

  it('should not compile when the place is the port kind', () => {
    // @ts-expect-error PORT is said with a port number
    instrumentAvailabilityBlock({ instrument: 'GNIRS', interval, at: { place: 'PORT' } });
  });
});
