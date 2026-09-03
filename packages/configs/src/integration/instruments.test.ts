import type { InstrumentConfig, QueryinstrumentsArgs } from '../graphql/gen/types.generated.ts';
import { test } from './setup.ts';

describe('Instruments', () => {
  test('gets instruments', async ({ executeGraphql }) => {
    const response = await executeGraphql<QueryinstrumentsArgs, { instruments: InstrumentConfig[] }>({
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

    expect(response.data?.instruments).toStrictEqual([
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

  test('gets instruments with extraParams', async ({ executeGraphql }) => {
    const response = await executeGraphql<QueryinstrumentsArgs, { instruments: InstrumentConfig[] }>({
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

    expect(response.data?.instruments).toStrictEqual([
      {
        issPort: 3,
        name: 'GMOS_SOUTH',
        wfs: 'OIWFS',
        extraParams: { ifu: true },
      },
    ]);
  });
});
