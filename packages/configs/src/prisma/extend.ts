import { toAngle, toDeclination, toProperMotion, toRightAscension } from '@gemini-hlsw/lucuma-core';

import type { Angle, Declination, ProperMotion, RightAscension } from '../graphql/gen/types.generated.ts';
import type { PrismaClient } from './gen/client.ts';

/**
 * Extend the prisma client by adding computed fields to Target
 */
export function extendPrisma(prisma: PrismaClient) {
  return prisma.$extends({
    result: {
      siderealTarget: {
        ra: {
          needs: { type: true, coord1: true },
          compute(target): RightAscension | undefined {
            if (target.type === 'FIXED') {
              return undefined;
            } else {
              return toRightAscension(target.coord1);
            }
          },
        },
        dec: {
          needs: { type: true, coord2: true },
          compute(target): Declination | undefined {
            if (target.type === 'FIXED') {
              return undefined;
            } else {
              return toDeclination(target.coord2);
            }
          },
        },
        az: {
          needs: { type: true, coord1: true },
          compute(target): Angle | undefined {
            if (target.type === 'FIXED') {
              return toAngle(target.coord1);
            } else {
              return undefined;
            }
          },
        },
        el: {
          needs: { type: true, coord2: true },
          compute(target): Angle | undefined {
            if (target.type === 'FIXED') {
              return toAngle(target.coord2);
            } else {
              return undefined;
            }
          },
        },
        properMotion: {
          needs: { type: true, pmRa: true, pmDec: true },
          compute(target): ProperMotion | undefined {
            if (target.type === 'FIXED' || target.pmRa === null || target.pmDec === null) {
              return undefined;
            } else {
              return toProperMotion(target.pmRa, target.pmDec);
            }
          },
        },
      },
      engineeringTarget: {
        ra: {
          needs: { type: true, coord1: true },
          compute(target): RightAscension | undefined {
            if (target.type === 'FIXED') {
              return undefined;
            } else {
              return toRightAscension(target.coord1);
            }
          },
        },
        dec: {
          needs: { type: true, coord2: true },
          compute(target): Declination | undefined {
            if (target.type === 'FIXED') {
              return undefined;
            } else {
              return toDeclination(target.coord2);
            }
          },
        },
        az: {
          needs: { type: true, coord1: true },
          compute(target): Angle | undefined {
            if (target.type === 'FIXED') {
              return toAngle(target.coord1);
            } else {
              return undefined;
            }
          },
        },
        el: {
          needs: { type: true, coord2: true },
          compute(target): Angle | undefined {
            if (target.type === 'FIXED') {
              return toAngle(target.coord2);
            } else {
              return undefined;
            }
          },
        },
        properMotion: {
          needs: { type: true, pmRa: true, pmDec: true },
          compute(target): ProperMotion | undefined {
            if (target.type === 'FIXED' || target.pmRa === null || target.pmDec === null) {
              return undefined;
            } else {
              return toProperMotion(target.pmRa, target.pmDec);
            }
          },
        },
      },
    },
  });
}
