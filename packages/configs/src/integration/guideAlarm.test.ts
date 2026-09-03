import type { MutationupdateGuideAlarmArgs } from '../graphql/gen/types.generated.ts';
import { test } from './setup.ts';

describe('GuideAlarm', () => {
  test('guideAlarms query returns seeded results', async ({ executeGraphql }) => {
    const response = await executeGraphql({
      query: `#graphql
        query guideAlarms {
          guideAlarms {
            OIWFS {
              limit
              enabled
            }
            PWFS1 {
              limit
              enabled
            }
            PWFS2 {
              limit
              enabled
            }
          }
        }`,
      variables: {},
    });

    expect(response.data).toMatchObject({
      guideAlarms: {
        OIWFS: {
          enabled: true,
          limit: 1000,
        },
        PWFS1: {
          enabled: true,
          limit: 1000,
        },
        PWFS2: {
          enabled: true,
          limit: 1000,
        },
      },
    });
  });

  test('updateGuideAlarm mutation updates the guide alarm', async ({ executeGraphql, prisma }) => {
    await executeGraphql<MutationupdateGuideAlarmArgs>({
      query: `#graphql
        mutation updateGuideAlarm($wfs: WfsType!, $enabled: Boolean, $limit: Int) {
          updateGuideAlarm(wfs: $wfs, enabled: $enabled, limit: $limit) {
            enabled
            limit
          }
        }`,
      variables: {
        wfs: 'PWFS1',
        enabled: false,
        limit: 1000,
      },
    });

    expect(await prisma.guideAlarm.findFirstOrThrow({ where: { wfs: 'PWFS1' } })).toStrictEqual({
      wfs: 'PWFS1',
      enabled: false,
      limit: 1000,
    });
  });
});
