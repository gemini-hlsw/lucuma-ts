import assert from 'node:assert';
import { describe, it } from 'node:test';

import type { ImportObservationInput } from '../graphql/gen/types.generated.ts';
import { initializeServerFixture } from './setup.ts';

await describe('importObservation', async () => {
  const fixture = initializeServerFixture();

  const query = `#graphql
    mutation doImportObservation($input: ImportObservationInput!) {
      importObservation(input: $input) {
        rotator {
          pk
        }
        configuration {
          pk
        }
      }
    }`;

  await it('imports rotator and configuration data', async () => {
    const response = await fixture.executeGraphql({
      query,
      variables: {
        input: {
          configurationPk: 1,
          rotatorPk: 1,
          guideLoopPk: 1,
          observation: {
            id: 'o-123',
            title: 'obs title',
            subtitle: 'obs subtitle',
            reference: undefined,
            instrument: 'GMOS_NORTH',
          },
          targets: {
            base: [],
            oiwfs: [],
            pwfs1: [],
            pwfs2: [],
          },
          guideEnvironmentAngle: { degrees: 1.1 },
        } satisfies ImportObservationInput,
      },
    });

    assert.deepEqual(await fixture.prisma.rotator.findUnique({ where: { pk: 1 } }), {
      pk: 1,
      tracking: 'TRACKING',
      angle: 1.1,
    });
    assert.deepEqual(await fixture.prisma.configuration.findUnique({ where: { pk: 1 } }), {
      pk: 1,
      baffleMode: 'AUTO',
      centralBaffle: null,
      deployableBaffle: null,
      obsId: 'o-123',
      obsInstrument: 'GMOS_NORTH',
      obsReference: null,
      obsSubtitle: 'obs subtitle',
      obsTitle: 'obs title',
      oiGuidingType: 'NORMAL',
      p1GuidingType: 'NORMAL',
      p2GuidingType: 'NORMAL',
      selectedGuiderTarget: null,
      selectedOiTarget: null,
      selectedP1Target: null,
      selectedP2Target: null,
      selectedTarget: null,
    });
    assert.deepStrictEqual(response.data, {
      importObservation: {
        configuration: { pk: 1 },
        rotator: { pk: 1 },
      },
    });
  });

  await it('imports targets', async () => {
    const response = await fixture.executeGraphql({
      query,
      variables: {
        input: {
          configurationPk: 1,
          rotatorPk: 1,
          guideLoopPk: 1,
          observation: {
            id: 'o-456',
            title: 'obs title 2',
            subtitle: 'obs subtitle 2',
            reference: 'ref-456',
            instrument: 'GMOS_SOUTH',
          },
          targets: {
            base: [
              {
                id: 't-1',
                name: 'Base Target',
                type: 'SCIENCE',
                sidereal: {
                  coord1: 10,
                  coord2: 20,
                },
              },
              {
                id: 't-2',
                name: 'Base Nonsidereal Target',
                type: 'BLINDOFFSET',
                nonsidereal: {
                  des: '2024 AB',
                  keyType: 'MAJOR_BODY',
                },
              },
            ],
            oiwfs: [
              {
                id: 't-3',
                name: 'OIWFS Target',
                type: 'OIWFS',
                sidereal: {
                  coord1: 30,
                  coord2: 40,
                },
              },
            ],
            pwfs1: [],
            pwfs2: [],
          },
          guideEnvironmentAngle: { degrees: 2.2 },
        } satisfies ImportObservationInput,
      },
    });

    assert.deepEqual(
      await fixture.prisma.target.findMany({
        select: {
          id: true,
          name: true,
          type: true,
          sidereal: { select: { coord1: true, coord2: true } },
          nonsidereal: { select: { des: true, keyType: true } },
        },
      }),
      [
        { id: 't-1', name: 'Base Target', type: 'SCIENCE', sidereal: { coord1: 10, coord2: 20 }, nonsidereal: null },
        {
          id: 't-2',
          name: 'Base Nonsidereal Target',
          type: 'BLINDOFFSET',
          sidereal: null,
          nonsidereal: { des: '2024 AB', keyType: 'MAJOR_BODY' },
        },
        { id: 't-3', name: 'OIWFS Target', type: 'OIWFS', sidereal: { coord1: 30, coord2: 40 }, nonsidereal: null },
      ],
    );
    assert.deepEqual(await fixture.prisma.configuration.findUnique({ where: { pk: 1 } }), {
      pk: 1,
      baffleMode: 'AUTO',
      centralBaffle: null,
      deployableBaffle: null,
      obsId: 'o-456',
      obsInstrument: 'GMOS_SOUTH',
      obsReference: 'ref-456',
      obsSubtitle: 'obs subtitle 2',
      obsTitle: 'obs title 2',
      oiGuidingType: 'NORMAL',
      p1GuidingType: 'NORMAL',
      p2GuidingType: 'NORMAL',
      selectedGuiderTarget: 3,
      selectedOiTarget: 3,
      selectedP1Target: null,
      selectedP2Target: null,
      selectedTarget: 1,
    });
    assert.deepEqual(await fixture.prisma.guideLoop.findUnique({ where: { pk: 1 } }), {
      pk: 1,
      m2TipTiltEnable: true,
      m2TipTiltSource: 'OIWFS',
      m2FocusEnable: true,
      m2FocusSource: 'OIWFS',
      m2TipTiltFocusLink: true,
      m2ComaEnable: false,
      m1CorrectionsEnable: true,
      m2ComaM1CorrectionsSource: 'OIWFS',
      mountOffload: true,
      daytimeMode: true,
      probeTracking: 'NONE',
      lightPath: 'Sky ➡ AO ➡ AC',
    });
    assert.deepStrictEqual(response.data, {
      importObservation: {
        configuration: { pk: 1 },
        rotator: { pk: 1 },
      },
    });
  });

  await it('sets guide correction source from selected PWFS guider', async () => {
    await fixture.executeGraphql({
      query,
      variables: {
        input: {
          configurationPk: 1,
          rotatorPk: 1,
          guideLoopPk: 1,
          observation: {
            id: 'o-900',
            title: 'obs title 900',
            subtitle: 'obs subtitle 900',
            reference: 'ref-900',
            instrument: 'GMOS_NORTH',
          },
          targets: {
            base: [],
            oiwfs: [],
            pwfs1: [
              {
                id: 't-900',
                name: 'PWFS1 Target',
                sidereal: {
                  coord1: 10,
                  coord2: 20,
                },
              },
            ],
            pwfs2: [],
          },
          guideEnvironmentAngle: { degrees: 3.1 },
        } satisfies ImportObservationInput,
      },
    });

    assert.deepEqual(await fixture.prisma.guideLoop.findUnique({ where: { pk: 1 } }), {
      pk: 1,
      m2TipTiltEnable: true,
      m2TipTiltSource: 'PWFS1',
      m2FocusEnable: true,
      m2FocusSource: 'PWFS1',
      m2TipTiltFocusLink: true,
      m2ComaEnable: true,
      m1CorrectionsEnable: true,
      m2ComaM1CorrectionsSource: 'PWFS1',
      mountOffload: true,
      daytimeMode: true,
      probeTracking: 'NONE',
      lightPath: 'Sky ➡ AO ➡ AC',
    });
  });

  await it('disables guide corrections when no guider targets are selected', async () => {
    await fixture.executeGraphql({
      query,
      variables: {
        input: {
          configurationPk: 1,
          rotatorPk: 1,
          guideLoopPk: 1,
          observation: {
            id: 'o-800',
            title: 'obs title 800',
            subtitle: 'obs subtitle 800',
            reference: 'ref-800',
            instrument: 'GMOS_NORTH',
          },
          targets: {
            base: [
              {
                id: 't-800',
                name: 'Base Target Only',
                type: 'SCIENCE',
                sidereal: {
                  coord1: 10,
                  coord2: 20,
                },
              },
            ],
            oiwfs: [],
            pwfs1: [],
            pwfs2: [],
          },
          guideEnvironmentAngle: { degrees: 2.5 },
        } satisfies ImportObservationInput,
      },
    });

    assert.deepEqual(await fixture.prisma.guideLoop.findUnique({ where: { pk: 1 } }), {
      pk: 1,
      m2TipTiltEnable: false,
      m2TipTiltSource: '',
      m2FocusEnable: false,
      m2FocusSource: '',
      m2TipTiltFocusLink: true,
      m2ComaEnable: false,
      m1CorrectionsEnable: false,
      m2ComaM1CorrectionsSource: '',
      mountOffload: true,
      daytimeMode: true,
      probeTracking: 'NONE',
      lightPath: 'Sky ➡ AO ➡ AC',
    });
  });

  await it('disables guide corrections when multiple guider types are selected', async () => {
    await fixture.executeGraphql({
      query,
      variables: {
        input: {
          configurationPk: 1,
          rotatorPk: 1,
          guideLoopPk: 1,
          observation: {
            id: 'o-850',
            title: 'obs title 850',
            subtitle: 'obs subtitle 850',
            reference: 'ref-850',
            instrument: 'GMOS_NORTH',
          },
          targets: {
            base: [],
            oiwfs: [
              {
                id: 't-4',
                name: 'OIWFS Target',
                sidereal: {
                  coord1: 10,
                  coord2: 20,
                },
              },
            ],
            pwfs1: [
              {
                id: 't-5',
                name: 'PWFS1 Target',
                sidereal: {
                  coord1: 30,
                  coord2: 40,
                },
              },
            ],
            pwfs2: [],
          },
          guideEnvironmentAngle: { degrees: 2.7 },
        } satisfies ImportObservationInput,
      },
    });

    assert.deepEqual(await fixture.prisma.guideLoop.findUnique({ where: { pk: 1 } }), {
      pk: 1,
      m2TipTiltEnable: false,
      m2TipTiltSource: '',
      m2FocusEnable: false,
      m2FocusSource: '',
      m2TipTiltFocusLink: true,
      m2ComaEnable: false,
      m1CorrectionsEnable: false,
      m2ComaM1CorrectionsSource: '',
      mountOffload: true,
      daytimeMode: true,
      probeTracking: 'NONE',
      lightPath: 'Sky ➡ AO ➡ AC',
    });
  });

  await it('sets guide correction source to PWFS2 when selected', async () => {
    await fixture.executeGraphql({
      query,
      variables: {
        input: {
          configurationPk: 1,
          rotatorPk: 1,
          guideLoopPk: 1,
          observation: {
            id: 'o-950',
            title: 'obs title 950',
            subtitle: 'obs subtitle 950',
            reference: 'ref-950',
            instrument: 'GMOS_NORTH',
          },
          targets: {
            base: [],
            oiwfs: [],
            pwfs1: [],
            pwfs2: [
              {
                id: 't-950',
                name: 'PWFS2 Target',
                sidereal: {
                  coord1: 50,
                  coord2: 60,
                },
              },
            ],
          },
          guideEnvironmentAngle: { degrees: 3.5 },
        } satisfies ImportObservationInput,
      },
    });

    assert.deepEqual(await fixture.prisma.guideLoop.findUnique({ where: { pk: 1 } }), {
      pk: 1,
      m2TipTiltEnable: true,
      m2TipTiltSource: 'PWFS2',
      m2FocusEnable: true,
      m2FocusSource: 'PWFS2',
      m2TipTiltFocusLink: true,
      m2ComaEnable: true,
      m1CorrectionsEnable: true,
      m2ComaM1CorrectionsSource: 'PWFS2',
      mountOffload: true,
      daytimeMode: true,
      probeTracking: 'NONE',
      lightPath: 'Sky ➡ AO ➡ AC',
    });
  });

  await it('deletes temporary instruments', async () => {
    await fixture.prisma.instrument.create({
      data: {
        name: 'GMOS_NORTH',
        isTemporary: true,
        issPort: 2,
        extraParams: {},
      },
    });

    await fixture.executeGraphql({
      query,
      variables: {
        input: {
          configurationPk: 1,
          rotatorPk: 1,
          guideLoopPk: 1,
          observation: {
            id: 'o-789',
            title: 'obs title 3',
            subtitle: 'obs subtitle 3',
            reference: 'ref-789',
            instrument: 'GMOS_NORTH',
          },
          targets: {
            base: [],
            oiwfs: [],
            pwfs1: [],
            pwfs2: [],
          },
          guideEnvironmentAngle: { degrees: 3.3 },
        } satisfies ImportObservationInput,
      },
    });

    const instruments = await fixture.prisma.instrument.findMany({ where: { isTemporary: true } });
    assert.strictEqual(instruments.length, 0);
  });
});
