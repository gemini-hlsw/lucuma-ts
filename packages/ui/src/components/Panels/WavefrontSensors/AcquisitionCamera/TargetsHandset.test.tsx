import type { MockLink } from '@apollo/client/testing';
import { GET_CONFIGURATION } from '@gql/configs/Configuration';
import type { InstrumentItemFragment } from '@gql/configs/gen/graphql';
import { GET_INSTRUMENT, UPDATE_INSTRUMENT } from '@gql/configs/Instrument';
import type { AdjustTarget } from '@gql/server/gen/graphql';
import { GET_INSTRUMENT_PORT } from '@gql/server/Instrument';
import {
  ABSORB_TARGET_ADJUSTMENT_MUTATION,
  ADJUST_TARGET_MUTATION,
  RESET_TARGET_ADJUSTMENT_MUTATION,
  TARGET_ADJUSTMENT_OFFSETS_QUERY,
  TARGET_ADJUSTMENT_OFFSETS_SUBSCRIPTION,
} from '@gql/server/TargetsHandset';
import type { MockedResponseOf } from '@gql/util';
import type { ResultOf, VariablesOf } from '@graphql-typed-document-node/core';
import type { DocumentNode } from 'graphql';
import { userEvent } from 'vitest/browser';

import { createConfiguration, createFocalPlaneOffset, createInstrumentConfig } from '@/test/create';
import { operationOutcome, selectDropdownOption } from '@/test/helpers';
import { type RenderResultWithStore, renderWithContext } from '@/test/render';

import type { Alignment } from './Controls';
import TargetsHandset from './TargetsHandset';

describe(TargetsHandset.name, () => {
  let sut: RenderResultWithStore;

  beforeEach(async () => {
    sut = await renderWithContext(<TargetsHandset canEdit={true} />, { mocks });
  });

  it('should render', () => {
    expect(sut.container).toBeVisible();
  });

  it('clicking applies calls adjustTarget mutation', async () => {
    await userEvent.click(sut.getByRole('button', { name: 'Apply' }));

    expect(adjustTargetMutationMock.request.variables).toHaveBeenCalledExactlyOnceWith({
      target: 'OIWFS',
      offset: {
        focalPlaneAdjustment: {
          deltaX: { arcseconds: 0.0 },
          deltaY: { arcseconds: 0.0 },
        },
      },
      openLoops: true,
    });
  });

  it('clicking reset calls resetTargetAdjustment mutation', async () => {
    await userEvent.click(sut.getByRole('button', { name: 'Reset' }));

    expect(resetTargetAdjustmentMutationMock.request.variables).toHaveBeenCalledExactlyOnceWith({
      target: 'OIWFS',
      openLoops: true,
    });
  });

  it('clicking absorb calls absorbTargetAdjustment mutation', async () => {
    await userEvent.click(sut.getByRole('button', { name: 'Absorb' }));

    expect(absorbTargetAdjustmentMutationMock.request.variables).toHaveBeenCalledExactlyOnceWith({
      target: 'OIWFS',
    });
  });

  it('switching target sends different target to absorbTargetAdjustment mutation', async () => {
    await selectTarget('PWFS1');
    await userEvent.click(sut.getByRole('button', { name: 'Absorb' }));

    expect(absorbTargetAdjustmentMutationMock.request.variables).toHaveBeenCalledWith({
      target: 'PWFS1',
    });
  });

  it('should be disabled when canEdit is false', async () => {
    await sut.rerender(<TargetsHandset canEdit={false} />);

    expect(sut.getByRole('button', { name: 'Apply' })).toBeDisabled();
    expect(sut.getByRole('button', { name: 'Reset' })).toBeDisabled();
    expect(sut.getByRole('button', { name: 'Absorb' })).toBeDisabled();
  });

  it('shows align angle input when OIWFS is selected', async () => {
    await selectAlignment('OIWFS');
    const alignAngleInput = sut.getByLabelText('Align angle');

    await userEvent.type(alignAngleInput, '45{Enter}');

    expect(updateInstrumentMock.request.variables).toHaveBeenCalledExactlyOnceWith({
      pk: 1,
      alignAngle: 45,
    });
  });

  it('hides align angle input when other than OIWFS is selected', async () => {
    await selectAlignment('Az/El');

    expect(sut.getByLabelText('Align angle')).not.toBeInTheDocument();
  });

  it.each([
    [
      'UP',
      '+El',
      {
        elevation: { arcseconds: 0.5 },
        azimuth: { arcseconds: 0 },
      },
    ],
    [
      'DOWN',
      '-El',
      {
        elevation: { arcseconds: -0.5 },
        azimuth: { arcseconds: 0 },
      },
    ],
    [
      'RIGHT',
      '+Az',
      {
        elevation: { arcseconds: 0 },
        azimuth: { arcseconds: 0.5 },
      },
    ],
    [
      'LEFT',
      '-Az',
      {
        elevation: { arcseconds: 0 },
        azimuth: { arcseconds: -0.5 },
      },
    ],
  ])('inputs for Az/El %s matches %s', async (testId, label, expectedInput) => {
    await selectAlignment('Az/El');
    await testDirectionButtonClick<typeof ADJUST_TARGET_MUTATION>(testId, label, adjustTargetMutationMock, {
      target: 'OIWFS',
      offset: { horizontalAdjustment: expectedInput },
      openLoops: true,
    });
  });

  it.each([
    [
      'UP',
      '-X',
      {
        deltaX: { arcseconds: -0.5 },
        deltaY: { arcseconds: 0 },
      },
    ],
    [
      'DOWN',
      '+X',
      {
        deltaX: { arcseconds: 0.5 },
        deltaY: { arcseconds: 0 },
      },
    ],
    [
      'RIGHT',
      '+Y',
      {
        deltaY: { arcseconds: 0.5 },
        deltaX: { arcseconds: 0 },
      },
    ],
    [
      'LEFT',
      '-Y',
      {
        deltaX: { arcseconds: 0 },
        deltaY: { arcseconds: -0.5 },
      },
    ],
  ])('inputs for AC %s matches %s', async (testId, label, expectedInput) => {
    await userEvent.click(sut.getByLabelText('Open loops'));
    await testDirectionButtonClick<typeof ADJUST_TARGET_MUTATION>(testId, label, adjustTargetMutationMock, {
      target: 'OIWFS',
      openLoops: false,
      offset: { focalPlaneAdjustment: expectedInput },
    });
  });

  it.each([
    [
      'UP',
      '-Q',
      {
        q: { arcseconds: -0.5 },
        p: { arcseconds: 0 },
      },
    ],
    [
      'DOWN',
      '+Q',
      {
        q: { arcseconds: 0.5 },
        p: { arcseconds: 0 },
      },
    ],
    [
      'RIGHT',
      '+P',
      {
        q: { arcseconds: 0 },
        p: { arcseconds: 0.5 },
      },
    ],
    [
      'LEFT',
      '-P',
      {
        q: { arcseconds: 0 },
        p: { arcseconds: -0.5 },
      },
    ],
  ])('inputs for Instrument %s matches %s', async (testId, label, expectedInput) => {
    await selectAlignment('Instrument');
    await testDirectionButtonClick<typeof ADJUST_TARGET_MUTATION>(testId, label, adjustTargetMutationMock, {
      target: 'OIWFS',
      offset: { instrumentAdjustment: expectedInput },
      openLoops: true,
    });
  });

  it.each([
    [
      'UP',
      'N',
      {
        deltaDec: { arcseconds: 0.5 },
        deltaRA: { arcseconds: 0 },
      },
    ],
    [
      'DOWN',
      'S',
      {
        deltaDec: { arcseconds: -0.5 },
        deltaRA: { arcseconds: 0 },
      },
    ],
    [
      'RIGHT',
      'W',
      {
        deltaDec: { arcseconds: 0 },
        deltaRA: { arcseconds: 0.5 },
      },
    ],
    [
      'LEFT',
      'E',
      {
        deltaDec: { arcseconds: 0 },
        deltaRA: { arcseconds: -0.5 },
      },
    ],
  ])('inputs for RA/Dec %s matches %s', async (testId, label, expectedInput) => {
    await selectAlignment('RA/Dec');
    await testDirectionButtonClick<typeof ADJUST_TARGET_MUTATION>(testId, label, adjustTargetMutationMock, {
      target: 'OIWFS',
      offset: { equatorialAdjustment: expectedInput },
      openLoops: true,
    });
  });

  it.each([
    [
      'UP',
      {
        deltaV: { arcseconds: 0.5 },
        deltaU: { arcseconds: 0 },
      },
    ],
    [
      'DOWN',
      {
        deltaV: { arcseconds: -0.5 },
        deltaU: { arcseconds: 0 },
      },
    ],
    [
      'RIGHT',
      {
        deltaV: { arcseconds: 0 },
        deltaU: { arcseconds: 0.5 },
      },
    ],
    [
      'LEFT',
      {
        deltaV: { arcseconds: 0 },
        deltaU: { arcseconds: -0.5 },
      },
    ],
  ] as const)('inputs for PWFS2 %s matches', async (testId, expectedInput) => {
    getInstrumentMock.result.mockReturnValue({
      data: {
        instrument: createInstrumentConfig({
          wfs: 'PWFS2',
        }),
      },
    });
    await sut.rerender(<TargetsHandset canEdit={true} />);
    await selectAlignment('PWFS2');
    await testDirectionButtonClick<typeof ADJUST_TARGET_MUTATION>(testId, undefined, adjustTargetMutationMock, {
      target: 'OIWFS',
      openLoops: true,
      offset: { probeFrameAdjustment: { ...expectedInput, probeFrame: 'PWFS2' } },
    });
  });

  async function selectAlignment(alignment: Alignment) {
    await selectDropdownOption(sut, 'Select alignment', alignment);
  }

  async function selectTarget(target: AdjustTarget) {
    await selectDropdownOption(sut, 'Select target', target);
  }

  async function testDirectionButtonClick<T extends DocumentNode>(
    testId: string,
    label: string | undefined,
    mock: MockedResponseOf<T>,
    expectedInput: VariablesOf<T>,
  ) {
    const button = sut.getByTestId(testId);
    if (label) await expect.element(button).toHaveAttribute('aria-label', label);
    await userEvent.click(button);

    expect(mock.request.variables).toHaveBeenCalledWith(expectedInput);
  }
});

const targetAdjustmentOffsetsData: ResultOf<typeof TARGET_ADJUSTMENT_OFFSETS_QUERY> = {
  targetAdjustmentOffsets: {
    sourceA: createFocalPlaneOffset(),
    pwfs1: createFocalPlaneOffset(),
    pwfs2: createFocalPlaneOffset(),
    oiwfs: createFocalPlaneOffset(),
    __typename: 'TargetOffsets',
  },
};

const resetTargetAdjustmentMutationMock = {
  request: {
    query: RESET_TARGET_ADJUSTMENT_MUTATION,
    variables: vi.fn().mockReturnValue(true),
  },
  result: {
    data: { resetTargetAdjustment: operationOutcome },
  },
} satisfies MockedResponseOf<typeof RESET_TARGET_ADJUSTMENT_MUTATION>;

const adjustTargetMutationMock = {
  request: {
    query: ADJUST_TARGET_MUTATION,
    variables: vi.fn().mockReturnValue(true),
  },
  maxUsageCount: Infinity,
  result: {
    data: { adjustTarget: operationOutcome },
  },
} satisfies MockedResponseOf<typeof ADJUST_TARGET_MUTATION>;

const absorbTargetAdjustmentMutationMock = {
  request: {
    query: ABSORB_TARGET_ADJUSTMENT_MUTATION,
    variables: vi.fn().mockReturnValue(true),
  },
  result: {
    data: { absorbTargetAdjustment: operationOutcome },
  },
} satisfies MockedResponseOf<typeof ABSORB_TARGET_ADJUSTMENT_MUTATION>;

const getInstrumentMock = {
  request: {
    query: GET_INSTRUMENT,
    variables: vi.fn().mockReturnValue(true),
  },
  maxUsageCount: Infinity,
  result: vi.fn().mockReturnValue({
    data: {
      instrument: createInstrumentConfig({
        wfs: 'OIWFS',
      }),
    },
  }),
} satisfies MockedResponseOf<typeof GET_INSTRUMENT>;

const updateInstrumentMock = {
  request: {
    query: UPDATE_INSTRUMENT,
    variables: vi.fn().mockReturnValue(true),
  },
  maxUsageCount: Infinity,
  result: (arg) => ({
    data: {
      updateInstrument: createInstrumentConfig({
        wfs: 'OIWFS',
        ...(arg as Partial<InstrumentItemFragment>),
      }),
    },
  }),
} satisfies MockedResponseOf<typeof UPDATE_INSTRUMENT>;

const mocks: MockLink.MockedResponse[] = [
  {
    request: {
      query: GET_CONFIGURATION,
      variables: {},
    },
    result: {
      data: {
        configuration: createConfiguration({
          selectedOiTarget: 1,
          selectedP1Target: 2,
          selectedP2Target: 3,
          selectedGuiderTarget: 1,
          selectedTarget: 4,
        }),
      },
    },
  } satisfies MockedResponseOf<typeof GET_CONFIGURATION>,
  {
    request: {
      query: TARGET_ADJUSTMENT_OFFSETS_QUERY,
      variables: {},
    },
    result: {
      data: targetAdjustmentOffsetsData,
    },
  } satisfies MockedResponseOf<typeof TARGET_ADJUSTMENT_OFFSETS_QUERY>,
  {
    request: {
      query: TARGET_ADJUSTMENT_OFFSETS_SUBSCRIPTION,
      variables: {},
    },
    maxUsageCount: Infinity,
    result: {
      data: targetAdjustmentOffsetsData,
    },
  } satisfies MockedResponseOf<typeof TARGET_ADJUSTMENT_OFFSETS_SUBSCRIPTION>,
  {
    request: {
      query: GET_INSTRUMENT_PORT,
      variables: () => true,
    },
    maxUsageCount: Infinity,
    result: {
      data: {
        instrumentPort: 3,
      },
    },
  } satisfies MockedResponseOf<typeof GET_INSTRUMENT_PORT>,
  adjustTargetMutationMock,
  resetTargetAdjustmentMutationMock,
  absorbTargetAdjustmentMutationMock,
  getInstrumentMock,
  updateInstrumentMock,
];
