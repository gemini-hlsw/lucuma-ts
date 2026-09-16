import type {
  InstrumentConfig,
  MutationupdateInstrumentArgs,
  QueryinstrumentArgs,
} from '../graphql/gen/types.generated.ts';
import { test } from './setup.ts';

describe('Instrument', () => {
  test('updateInstrument mutation updates the instrument', async ({ executeGraphql, prisma }) => {
    await executeGraphql<MutationupdateInstrumentArgs>({
      query: `#graphql
        mutation updateInstrument($pk: PosInt!, $extraParams: JSON!) {
          updateInstrument(pk: $pk, extraParams: $extraParams) {
            pk
            extraParams
          }
        }`,
      variables: {
        pk: 1,
        extraParams: { foo: 'bar' },
      },
    });

    expect((await prisma.instrument.findFirstOrThrow({ where: { pk: 1 } })).extraParams).toStrictEqual({
      foo: 'bar',
    });
  });

  describe('get nonexistent instrument configuration', () => {
    test('returns previous configuration as fallback', async ({ executeGraphql }) => {
      const response = await executeGraphql<QueryinstrumentArgs, { instrument: InstrumentConfig }>({
        query: `#graphql
          query instrument($name: Instrument!, $issPort: Int!, $wfs: WfsType!) {
            instrument(name: $name, issPort: $issPort, wfs: $wfs) {
              pk
              name
              issPort
              comment
            }
          }`,
        variables: { name: 'FLAMINGOS2', issPort: 5, wfs: 'OIWFS' },
      });

      expect(response.data?.instrument?.comment).includes(
        'Default fallback configuration, using parameters from previous configuration',
      );
    });

    test('returns a default configuration if no previous config is found', async ({ executeGraphql }) => {
      const response = await executeGraphql<QueryinstrumentArgs, { instrument: InstrumentConfig }>({
        query: `#graphql
          query instrument($name: Instrument!, $issPort: Int!, $wfs: WfsType!) {
            instrument(name: $name, issPort: $issPort, wfs: $wfs) {
              pk
              name
              issPort
              comment
            }
          }`,
        variables: { name: 'FLAMINGOS2', issPort: 1, wfs: 'OIWFS' },
      });

      expect(response.data?.instrument?.comment).includes(
        'Default fallback configuration, using empty configuration please modify manually',
      );
    });

    test('gets instrument with extraParams', async ({ executeGraphql }) => {
      const response = await executeGraphql<QueryinstrumentArgs, { instrument: InstrumentConfig }>({
        query: `#graphql
          query instrument($extraParams: JSON) {
            instrument(extraParams: $extraParams) {
              pk
              name
              issPort
              extraParams
            }
          }`,
        variables: {
          extraParams: { ifu: true },
        },
      });

      expect(response.data?.instrument?.extraParams).toStrictEqual({ ifu: true });
    });

    test('defaults to an empty extraParams match when extraParams is not given', async ({ executeGraphql, prisma }) => {
      // Insert a more-recent row with non-empty extraParams for the same name/issPort/wfs, so
      // an unfiltered `findFirst` (ordered by createdAt desc) would pick it over the base config.
      await prisma.instrument.create({
        data: {
          name: 'GMOS_SOUTH',
          issPort: 3,
          wfs: 'OIWFS',
          isTemporary: false,
          extraParams: { foo: 'bar' },
          ao: false,
          originX: 0.0,
          originY: 0.0,
          focusOffset: 0.0,
          iaa: 0.0,
        },
      });

      const response = await executeGraphql<QueryinstrumentArgs, { instrument: InstrumentConfig }>({
        query: `#graphql
          query instrument($name: Instrument!, $issPort: Int!, $wfs: WfsType!) {
            instrument(name: $name, issPort: $issPort, wfs: $wfs) {
              name
              issPort
              wfs
              extraParams
            }
          }`,
        variables: { wfs: 'OIWFS', name: 'GMOS_SOUTH', issPort: 3 },
      });
      expect(response.data?.instrument).toStrictEqual({
        name: 'GMOS_SOUTH',
        issPort: 3,
        wfs: 'OIWFS',
        extraParams: {},
      });
    });

    test('gets instruments without extraParams', async ({ executeGraphql }) => {
      const response = await executeGraphql<QueryinstrumentArgs, { instrument: InstrumentConfig }>({
        query: `#graphql
          query instrument($name: Instrument!, $issPort: Int!, $wfs: WfsType!, $extraParams: JSON) {
            instrument(name: $name, issPort: $issPort, wfs: $wfs, extraParams: $extraParams) {
              name
              issPort
              wfs
              extraParams
            }
          }`,
        variables: { wfs: 'OIWFS', name: 'GMOS_SOUTH', issPort: 3, extraParams: { ifu: false } },
      });
      expect(response.data?.instrument).toStrictEqual({
        name: 'GMOS_SOUTH',
        issPort: 3,
        wfs: 'OIWFS',
        extraParams: {},
      });
    });
  });
});
