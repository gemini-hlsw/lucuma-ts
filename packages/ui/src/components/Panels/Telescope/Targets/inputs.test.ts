import {
  createCalParams,
  createConfiguration,
  createInstrumentConfig,
  createRotator,
  createTarget,
} from '@/test/create';

import { createTcsConfigInput } from './inputs';

describe(createTcsConfigInput, () => {
  const create = (configuration = createConfiguration()) =>
    createTcsConfigInput(
      createInstrumentConfig(),
      createRotator(),
      createTarget(),
      createTarget({ type: 'OIWFS' }),
      createTarget({ type: 'PWFS1' }),
      createTarget({ type: 'PWFS2' }),
      createCalParams(),
      configuration,
    );

  it('should track probes in nod A chop A and nod B chop B for Normal Guiding', () => {
    const normalTracking = { nodAchopA: true, nodAchopB: false, nodBchopA: false, nodBchopB: true };

    const input = create();

    expect(input.oiwfs?.tracking).toEqual(normalTracking);
    expect(input.pwfs1?.tracking).toEqual(normalTracking);
    expect(input.pwfs2?.tracking).toEqual(normalTracking);
  });

  it('should not track the probe when its guiding is Off', () => {
    const input = create(createConfiguration({ p1GuidingType: 'OFF' }));

    expect(input.pwfs1?.tracking).toEqual({ nodAchopA: false, nodAchopB: false, nodBchopA: false, nodBchopB: false });
    expect(input.oiwfs?.tracking.nodAchopA).toBe(true);
    expect(input.pwfs2?.tracking.nodAchopA).toBe(true);
  });
});
