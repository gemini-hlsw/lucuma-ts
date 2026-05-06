import type { Instrument } from '../../graphql/gen/types.generated.ts';
import type { PrismaClient } from '../db.ts';
import type { Site } from '../gen/enums.ts';
import type { TypeMap } from '../gen/internal/prismaNamespaceBrowser.ts';
import { INITIAL_CAL_PARAMS } from './init/calParams.ts';
import { INITIAL_CONFIGURATION } from './init/configuration.ts';
import { INITIAL_ENGINEERING_TARGETS } from './init/engineeringTargets.ts';
import { INITIAL_GUIDE_ALARMS } from './init/guideAlarm.ts';
import { INITIAL_ALTAIR_GUIDE_LOOP, INITIAL_GEMS_GUIDE_LOOP, INITIAL_GUIDE_LOOP } from './init/guideLoop.ts';
import { INITIAL_ALTAIR_INSTRUMENT, INITIAL_GEMS_INSTRUMENT, INITIAL_INSTRUMENTS } from './init/instruments.ts';
import { INITIAL_MECHANISM } from './init/mechanism.ts';
import { INITIAL_ROTATOR } from './init/rotator.ts';
import { INITIAL_SLEW_FLAGS } from './init/slewFlags.ts';

type Models = TypeMap['model'];
type FindInput<T extends keyof Models> = Models[T]['operations']['findFirst']['args'];
type CreateManyInput<T extends keyof Models> = Models[T]['operations']['createMany']['args']['data'];

const site: Site = process.env.SITE?.toLowerCase().endsWith('gs') ? 'GS' : 'GN';

async function createRecord<TModel extends keyof Models>(
  prisma: PrismaClient,
  subject: TModel,
  initialRecord: CreateManyInput<TModel>,
  recordName: string,
  log: (msg: string) => void,
  findInput: FindInput<TModel> = {},
) {
  // Transform 'EngineeringTarget' to 'engineeringTarget'
  const lowercaseFirstLetter = (s: TModel) => (s.charAt(0).toLowerCase() + s.slice(1)) as TypeMap['meta']['modelProps'];

  const client = prisma[lowercaseFirstLetter(subject)];
  // @ts-expect-error Generic types are difficult with prisma
  if (await client.findFirst(findInput)) {
    log(`${recordName} already exist`);
    return;
  }

  log(`Creating ${recordName}`);
  // @ts-expect-error Generic types are difficult with prisma
  await client.createMany({
    data: initialRecord,
  });
}

async function createInstruments(prisma: PrismaClient, log: (msg: string) => void) {
  await updateInstrumentSite(prisma, log);

  const groupedInstruments = Object.groupBy(INITIAL_INSTRUMENTS, (inst) => inst.name);
  for (const [name, configs] of Object.entries(groupedInstruments)) {
    await createRecord(prisma, 'Instrument', configs, `Instrument ${name} configurations`, log, {
      where: { name },
    });
  }
  await createRecord(prisma, 'AltairInstrument', INITIAL_ALTAIR_INSTRUMENT, 'Altair instrument', log);
  await createRecord(prisma, 'GemsInstrument', INITIAL_GEMS_INSTRUMENT, 'Gems instrument', log);
}

async function createRotator(prisma: PrismaClient, log: (msg: string) => void) {
  await createRecord(prisma, 'Rotator', INITIAL_ROTATOR, 'Rotator', log);
}

async function createSlewFlags(prisma: PrismaClient, log: (msg: string) => void) {
  await createRecord(prisma, 'SlewFlags', INITIAL_SLEW_FLAGS, 'Slew flags', log);
}

async function createConfiguration(prisma: PrismaClient, log: (msg: string) => void) {
  await createRecord(prisma, 'Configuration', INITIAL_CONFIGURATION, 'Configuration', log);
}

async function createGuideLoopInfo(prisma: PrismaClient, log: (msg: string) => void) {
  await createRecord(prisma, 'AltairGuideLoop', INITIAL_ALTAIR_GUIDE_LOOP, 'Altair guide loop info', log);
  await createRecord(prisma, 'GemsGuideLoop', INITIAL_GEMS_GUIDE_LOOP, 'Gems guide loop info', log);
  await createRecord(prisma, 'GuideLoop', INITIAL_GUIDE_LOOP, 'General guide loop info', log);
}

async function createMechanism(prisma: PrismaClient, log: (msg: string) => void) {
  await createRecord(prisma, 'Mechanism', INITIAL_MECHANISM, 'Mechanism', log);
}

async function createGuideAlarms(prisma: PrismaClient, log: (msg: string) => void) {
  log('Creating guide alarms');
  for (const guideAlarm of INITIAL_GUIDE_ALARMS) {
    await prisma.guideAlarm.upsert({
      where: { wfs: guideAlarm.wfs },
      update: guideAlarm,
      create: guideAlarm,
    });
  }
}

async function createEngineeringTargets(prisma: PrismaClient, log: (msg: string) => void) {
  await createRecord(prisma, 'EngineeringTarget', INITIAL_ENGINEERING_TARGETS, 'Engineering targets', log);
}

async function createCalParams(prisma: PrismaClient, log: (msg: string) => void) {
  await createRecord(prisma, 'CalParams', INITIAL_CAL_PARAMS, 'CalParams', log);
}

async function updateInstrumentSite(prisma: PrismaClient, log: (msg: string) => void) {
  log('Updating instrument site');

  async function updateSite(from: string, toNorth: Instrument, toSouth: Instrument) {
    const to = site === 'GS' ? toSouth : toNorth;
    const [a, b, c] = await Promise.all([
      prisma.configuration.updateMany({
        where: { obsInstrument: from },
        data: { obsInstrument: to },
      }),
      prisma.instrument.updateMany({
        where: { name: from },
        data: { name: to },
      }),
      prisma.engineeringTarget.updateMany({
        where: { instrument: from },
        data: { instrument: to },
      }),
    ]);
    if (a.count > 0 || b.count > 0 || c.count > 0) {
      log(
        `Updated ${a.count} configurations, ${b.count} instruments and ${c.count} engineering targets from ${from} to ${to}`,
      );
    }
  }

  await updateSite('VISITOR', 'VISITOR_NORTH', 'VISITOR_SOUTH');
  await updateSite('ACQ_CAM', 'ACQ_CAM_NORTH', 'ACQ_CAM_SOUTH');
}

export async function write(client: PrismaClient, log: (msg: string) => void) {
  await createInstruments(client, log);
  await createSlewFlags(client, log);
  await createRotator(client, log);
  await createConfiguration(client, log);
  await createGuideLoopInfo(client, log);
  await createMechanism(client, log);
  await createGuideAlarms(client, log);
  await createEngineeringTargets(client, log);
  await createCalParams(client, log);

  await updateInstrumentSite(client, log);
}
