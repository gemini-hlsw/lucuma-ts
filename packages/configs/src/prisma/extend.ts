import { deg2dms, deg2hms } from '@gemini-hlsw/lucuma-core';

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
          compute(target) {
            if (target.type === 'FIXED') {
              return undefined;
            } else {
              return {
                hms: deg2hms(target.coord1),
                degrees: target.coord1,
              };
            }
          },
        },
        dec: {
          needs: { type: true, coord2: true },
          compute(target) {
            if (target.type === 'FIXED') {
              return undefined;
            } else {
              return {
                dms: deg2dms(target.coord2),
                degrees: target.coord2,
              };
            }
          },
        },
        az: {
          needs: { type: true, coord1: true },
          compute(target) {
            if (target.type === 'FIXED') {
              return {
                dms: deg2dms(target.coord1),
                degrees: target.coord1,
              };
            } else {
              return undefined;
            }
          },
        },
        el: {
          needs: { type: true, coord2: true },
          compute(target) {
            if (target.type === 'FIXED') {
              return {
                dms: deg2dms(target.coord2),
                degrees: target.coord2,
              };
            } else {
              return undefined;
            }
          },
        },
        properMotion: {
          needs: { type: true, pmRa: true, pmDec: true },
          compute(target) {
            if (target.type === 'FIXED' || target.pmRa === null || target.pmDec === null) {
              return undefined;
            } else {
              return {
                ra: target.pmRa,
                dec: target.pmDec,
              };
            }
          },
        },
      },
      engineeringTarget: {
        ra: {
          needs: { type: true, coord1: true },
          compute(target) {
            if (target.type === 'FIXED') {
              return undefined;
            } else {
              return {
                hms: deg2hms(target.coord1),
                degrees: target.coord1,
              };
            }
          },
        },
        dec: {
          needs: { type: true, coord2: true },
          compute(target) {
            if (target.type === 'FIXED') {
              return undefined;
            } else {
              return {
                dms: deg2dms(target.coord2),
                degrees: target.coord2,
              };
            }
          },
        },
        az: {
          needs: { type: true, coord1: true },
          compute(target) {
            if (target.type === 'FIXED') {
              return {
                dms: deg2dms(target.coord1),
                degrees: target.coord1,
              };
            } else {
              return undefined;
            }
          },
        },
        el: {
          needs: { type: true, coord2: true },
          compute(target) {
            if (target.type === 'FIXED') {
              return {
                dms: deg2dms(target.coord2),
                degrees: target.coord2,
              };
            } else {
              return undefined;
            }
          },
        },
        properMotion: {
          needs: { type: true, pmRa: true, pmDec: true },
          compute(target) {
            if (target.type === 'FIXED' || target.pmRa === null || target.pmDec === null) {
              return undefined;
            } else {
              return {
                ra: target.pmRa,
                dec: target.pmDec,
              };
            }
          },
        },
      },
    },
  });
}
