import type { Instrument, QueryResolvers } from './../../gen/types.generated.ts';

export const distinctInstruments: NonNullable<QueryResolvers['distinctInstruments']> = async (
  _parent,
  args,
  { prisma },
) => {
  const results = await prisma.instrument.findMany({
    distinct: ['name'],
    select: { name: true },
    where: { name: { not: { endsWith: args.site === 'GS' ? '_NORTH' : '_SOUTH' } } },
    orderBy: { name: 'asc' },
  });
  return results.map((r) => r.name as Instrument);
};
