import type { SiderealTargetUpdateInput, Target } from '../graphql/gen/types.generated.ts';
import { test } from './setup.ts';

describe('updateTarget', () => {
  test('updates a target', async ({ executeGraphql, prisma }) => {
    const target = await prisma.target.create({
      data: {
        id: 't-1',
        name: 'Initial Target',
        type: 'SCIENCE',
      },
      select: { pk: true },
    });
    const query = `#graphql
      mutation updateTarget($pk: PosInt!, $name: String!) {
        updateTarget(pk: $pk, name: $name) {
          pk
          name
        }
      }`;

    const response = await executeGraphql<Partial<Target>, { updateTarget: Target }>({
      query,
      variables: {
        pk: target.pk,
        name: 'Updated Target',
      },
    });

    expect(response.data?.updateTarget).toMatchObject({ pk: target.pk, name: 'Updated Target' });
    const updatedTarget = await prisma.target.findUnique({ where: { pk: target.pk } });
    expect(updatedTarget).toMatchObject({ name: 'Updated Target' });
  });

  test('also updates sidereal data', async ({ executeGraphql, prisma }) => {
    const target = await prisma.target.create({
      data: {
        id: 't-2',
        name: 'Sidereal Target',
        type: 'SCIENCE',
        sidereal: {
          create: {
            coord1: 10,
            coord2: 20,
            epoch: 'J2000',
          },
        },
      },
      select: { pk: true },
    });
    const query = `#graphql
      mutation updateTarget($pk: PosInt!, $sidereal: SiderealTargetUpdateInput!) {
        updateTarget(pk: $pk, sidereal: $sidereal) {
          pk
          name
          sidereal {
            epoch
          }
        }
      }`;

    const response = await executeGraphql<Record<string, unknown>, { updateTarget: Target }>({
      query,
      variables: {
        pk: target.pk,
        sidereal: {
          epoch: 'J2001',
        } satisfies SiderealTargetUpdateInput,
      },
    });

    expect(response.data?.updateTarget).toMatchObject({ pk: target.pk, sidereal: { epoch: 'J2001' } });
    const updatedTarget = await prisma.target.findUnique({
      where: { pk: target.pk },
      include: { sidereal: true },
    });
    expect(updatedTarget).toMatchObject({ sidereal: { epoch: 'J2001' } });
  });

  test('also updates nonsidereal data', async ({ executeGraphql, prisma }) => {
    const target = await prisma.target.create({
      data: {
        id: 't-3',
        name: 'Nonsidereal Target',
        type: 'BLINDOFFSET',
        nonsidereal: {
          create: {
            des: '2024 AB',
            keyType: 'MAJOR_BODY',
          },
        },
      },
      select: { pk: true },
    });
    const query = `#graphql
      mutation updateTarget($pk: PosInt!, $nonsidereal: NonsiderealTargetUpdateInput!) {
        updateTarget(pk: $pk, nonsidereal: $nonsidereal) {
          pk
          name
          nonsidereal {
            des
          }
        }
      }`;

    const response = await executeGraphql<Record<string, unknown>, { updateTarget: Target }>({
      query,
      variables: {
        pk: target.pk,
        nonsidereal: {
          des: '2024 AC',
        },
      },
    });

    expect(response.data?.updateTarget).toMatchObject({ pk: target.pk, nonsidereal: { des: '2024 AC' } });
    const updatedTarget = await prisma.target.findUnique({
      where: { pk: target.pk },
      include: { nonsidereal: true },
    });
    expect(updatedTarget).toMatchObject({ nonsidereal: { des: '2024 AC' } });
  });
});
