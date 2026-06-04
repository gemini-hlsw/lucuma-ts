import type { InputJsonValue } from '@prisma/client/runtime/client';

import type { InstrumentWhereInput, JsonFilter } from '../../../prisma/gen/models.ts';
import type { InstrumentConfig, QueryResolvers } from './../../gen/types.generated.ts';

export const instrument: NonNullable<QueryResolvers['instrument']> = async (_parent, args, { prisma, log }) => {
  const baseWhereArgs = {
    ...args,
    extraParams: createExtraParamsFilter(args.extraParams),
  } satisfies InstrumentWhereInput;

  let instrument = await prisma.instrument.findFirst({
    where: baseWhereArgs,
    orderBy: [{ isTemporary: 'desc' }, { createdAt: 'desc' }],
  });
  if (instrument) {
    return instrument as InstrumentConfig;
  }
  // If instrument was not found and wfs is not NONE
  // Try to get the instrument using wfs NONE
  if (args.wfs !== 'NONE') {
    instrument = await prisma.instrument.findFirst({
      where: {
        ...baseWhereArgs,
        wfs: 'NONE',
        isTemporary: false,
      },
      orderBy: { createdAt: 'desc' },
    });
  }
  // Create a default configuration to be manually modified if instrument was not found
  // Otherwise use the NONE wfs as default parameters
  if (!instrument) {
    log.debug(`No instrument found for ${JSON.stringify(args, undefined, 2)}, creating default configuration`);
    instrument = await prisma.instrument.create({
      data: {
        name: args.name ?? '',
        issPort: args.issPort ?? 1,
        wfs: args.wfs,
        isTemporary: false,
        extraParams: {},
        ao: false,
        originX: 0.0,
        originY: 0.0,
        focusOffset: 0.0,
        iaa: 0.0,
        comment: 'Default fallback configuration, using empty configuration please modify manually',
      },
    });
  } else {
    log.debug(
      `No instrument found for ${JSON.stringify(args, undefined, 2)}, creating default configuration using parameters from previous configuration with pk ${instrument.pk}`,
    );

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { pk, ...instArgs } = instrument;
    instrument = await prisma.instrument.create({
      data: {
        ...instArgs,
        wfs: args.wfs,
        isTemporary: false,
        extraParams: {},
        comment: 'Default fallback configuration, using parameters from previous configuration',
      },
    });
  }
  return instrument as InstrumentConfig;
};

export function createExtraParamsFilter(args: unknown): JsonFilter<'Instrument'> | undefined {
  return Object.entries(args ?? {}).map(([key, value]) => ({
    path: [key],
    equals: value as InputJsonValue,
  }))[0];
}
