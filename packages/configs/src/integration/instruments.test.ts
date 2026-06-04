import assert from 'node:assert';
import { describe, it } from 'node:test';

import type { InstrumentConfig, QueryinstrumentsArgs } from '../graphql/gen/types.generated.ts';
import { initializeServerFixture } from './setup.ts';

await describe('Instruments', async () => {
  const fixture = initializeServerFixture();

  await it('gets instruments', async () => {
    const response = await fixture.executeGraphql<QueryinstrumentsArgs, { instruments: InstrumentConfig[] }>({
      query: `#graphql
        query instruments($name: Instrument, $issPort: Int, $wfs: WfsType) {
          instruments(name: $name, issPort: $issPort, wfs: $wfs) {
            name
            issPort
            wfs
          }
        }`,
      variables: {
        name: 'GMOS_SOUTH',
        issPort: 3,
        wfs: 'OIWFS',
      },
    });

    assert.deepEqual(response.data?.instruments, [
      {
        issPort: 3,
        name: 'GMOS_SOUTH',
        wfs: 'OIWFS',
      },
      {
        issPort: 3,
        name: 'GMOS_SOUTH',
        wfs: 'OIWFS',
      },
    ]);
  });

  await it('gets instruments with extraParams', async () => {
    const response = await fixture.executeGraphql<QueryinstrumentsArgs, { instruments: InstrumentConfig[] }>({
      query: `#graphql
        query instruments($name: Instrument, $issPort: Int, $wfs: WfsType, $extraParams: JSON) {
          instruments(name: $name, issPort: $issPort, wfs: $wfs, extraParams: $extraParams) {
            name
            issPort
            wfs
            extraParams
          }
        }`,
      variables: {
        name: 'GMOS_SOUTH',
        issPort: 3,
        wfs: 'OIWFS',
        extraParams: { ifu: true },
      },
    });

    assert.deepStrictEqual(response.data?.instruments, [
      {
        issPort: 3,
        name: 'GMOS_SOUTH',
        wfs: 'OIWFS',
        extraParams: { ifu: true },
      },
    ]);
  });
});
