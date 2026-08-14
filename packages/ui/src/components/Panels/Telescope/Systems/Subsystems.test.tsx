import type { MockLink } from '@apollo/client/testing';
import { GET_MECHANISM } from '@gql/configs/Mechanism';
import {
  ECS_DOME_PARK_MUTATION,
  ECS_ENABLE_DOME_MUTATION,
  ECS_ENABLE_SHUTTERS_MUTATION,
  ECS_MOVE_WEST_VENT_GATE_MUTATION,
  ECS_SHUTTERS_PARK_MUTATION,
} from '@gql/server/ecs';
import {
  MOUNT_UNWRAP_MUTATION,
  PWFS1_PARK_MUTATION,
  PWFS1_UNWRAP_MUTATION,
  PWFS2_PARK_MUTATION,
  PWFS2_UNWRAP_MUTATION,
  ROTATOR_UNWRAP_MUTATION,
} from '@gql/server/park';
import { GET_TELESCOPE_STATE, TELESCOPE_STATE_SUBSCRIPTION } from '@gql/server/TelescopeState';
import type { MockedResponseOf } from '@gql/util';
import type { Locator } from 'vitest/browser';
import { userEvent } from 'vitest/browser';

import { createMechanism, createTelescopeState } from '@/test/create';
import { operationOutcome, selectDropdownOption } from '@/test/helpers';
import { type RenderResultWithStore, renderWithContext } from '@/test/render';
import type { EnclosureState } from '@/types';

import { BotSubsystems, TopSubsystems } from './Subsystems';

describe(TopSubsystems.name, () => {
  let sut: RenderResultWithStore;
  beforeEach(async () => {
    sut = await renderWithContext(<TopSubsystems canEdit={true} />, {
      mocks: [pwfs1ParkMock, pwfs2ParkMock, mountUnwrapMock, rotatorUnwrapMock, pwfs1UnwrapMock, pwfs2UnwrapMock],
    });
  });
  it('should render', async () => {
    await expect.element(sut.baseElement).toBeVisible();
    expect(sut.getByTestId('park-mcs')).toBeVisible();
    expect(sut.getByTestId('park-crcs')).toBeVisible();
    expect(sut.getByTestId('park-pwfs1')).toBeVisible();
    expect(sut.getByTestId('park-pwfs2')).toBeVisible();
    expect(sut.getByTestId('unwrap-mcs')).toBeVisible();
    expect(sut.getByTestId('unwrap-crcs')).toBeVisible();
    expect(sut.getByTestId('unwrap-pwfs1')).toBeVisible();
    expect(sut.getByTestId('unwrap-pwfs2')).toBeVisible();
  });

  it('pwfs1 park button calls mutation', async () => {
    const button = sut.getByTestId('park-pwfs1');
    await userEvent.click(button);

    expect(pwfs1ParkMock.request.variables).toHaveBeenCalled();
  });

  it('pwfs2 park button calls mutation', async () => {
    const button = sut.getByTestId('park-pwfs2');
    await userEvent.click(button);

    expect(pwfs2ParkMock.request.variables).toHaveBeenCalled();
  });

  it('mcs unwrap button calls mutation', async () => {
    const button = sut.getByTestId('unwrap-mcs');
    await userEvent.click(button);

    expect(mountUnwrapMock.request.variables).toHaveBeenCalled();
  });

  it('crcs unwrap button calls mutation', async () => {
    const button = sut.getByTestId('unwrap-crcs');
    await userEvent.click(button);

    expect(rotatorUnwrapMock.request.variables).toHaveBeenCalled();
  });

  it('pwfs1 unwrap button calls mutation', async () => {
    const button = sut.getByTestId('unwrap-pwfs1');
    await userEvent.click(button);

    expect(pwfs1UnwrapMock.request.variables).toHaveBeenCalled();
  });

  it('pwfs2 unwrap button calls mutation', async () => {
    const button = sut.getByTestId('unwrap-pwfs2');
    await userEvent.click(button);

    expect(pwfs2UnwrapMock.request.variables).toHaveBeenCalled();
  });
});

describe(BotSubsystems.name, () => {
  let sut: RenderResultWithStore;

  async function renderBotSubsystems(enclosure?: Partial<EnclosureState>) {
    sut = await renderWithContext(<BotSubsystems canEdit={true} />, {
      mocks: enclosureMocks(enclosure),
    });
    // The dome mode dropdown only shows a value once the enclosure state has arrived
    await expect.element(sut.getByLabelText('West vent gate')).toHaveValue('50');
  }

  it('does not command anything while the enclosure state has not arrived', async () => {
    sut = await renderWithContext(<BotSubsystems canEdit={true} />, {
      mocks: [mechanismMock, { ...telescopeStateMock(), delay: Infinity }, telescopeStateSubscriptionMock(Infinity)],
    });

    await expect.element(sut.getByTestId('move-west-vent-gate')).toBeDisabled();
    await expect.element(sut.getByTestId('set-dome-mode')).toBeDisabled();
    await expect.element(sut.getByTestId('set-shutter-mode')).toBeDisabled();
  });

  it('does not offer to apply anything that was not edited', async () => {
    await renderBotSubsystems();

    await expect.element(sut.getByTestId('move-west-vent-gate')).toBeDisabled();
    await expect.element(sut.getByTestId('set-dome-mode')).toBeDisabled();
    await expect.element(sut.getByTestId('set-shutter-mode')).toBeDisabled();
  });

  it('moves the west vent gate to the selected position', async () => {
    await renderBotSubsystems();

    await typeInto(sut.getByLabelText('West vent gate'), '75');

    const moveButton = sut.getByTestId('move-west-vent-gate');
    await expect.element(moveButton).toBeEnabled();
    await userEvent.click(moveButton);

    expect(moveWestVentGateMock.request.variables).toHaveBeenCalledExactlyOnceWith({ position: 75 });
  });

  it('sets the selected dome mode', async () => {
    await renderBotSubsystems();

    await selectDropdownOption(sut, 'Select a Dome Mode', 'Min Scatter');

    const setButton = sut.getByTestId('set-dome-mode');
    await expect.element(setButton).toBeEnabled();
    await userEvent.click(setButton);

    expect(enableDomeMock.request.variables).toHaveBeenCalledExactlyOnceWith({ mode: 'MIN_SCATTER' });
  });

  it('sets the shutter mode with the selected aperture', async () => {
    await renderBotSubsystems();

    await typeInto(sut.getByLabelText('Aperture', { exact: true }), '0.75');

    const setButton = sut.getByTestId('set-shutter-mode');
    await expect.element(setButton).toBeEnabled();
    await userEvent.click(setButton);

    expect(enableShuttersMock.request.variables).toHaveBeenCalledExactlyOnceWith({
      mode: { mode: 'TRACKING', aperture: { meters: 0.75 } },
    });
  });

  it('enables the dome with the selected mode while the dome is off', async () => {
    await renderBotSubsystems({ domeEnabled: false, domeMode: null });

    await expect.element(sut.getByTestId('set-dome-mode')).toBeDisabled();
    await selectDropdownOption(sut, 'Select a Dome Mode', 'Basic');

    const setButton = sut.getByTestId('set-dome-mode');
    await expect.element(setButton).toBeEnabled();
    await userEvent.click(setButton);

    expect(enableDomeMock.request.variables).toHaveBeenCalledExactlyOnceWith({ mode: 'BASIC' });
  });

  it('enables the shutters without an aperture while the shutters are off', async () => {
    await renderBotSubsystems({ shuttersEnabled: false, shuttersMode: null });

    await expect.element(sut.getByTestId('set-shutter-mode')).toBeDisabled();
    await selectDropdownOption(sut, 'Select a Shutter Mode', 'Fully Open');

    const setButton = sut.getByTestId('set-shutter-mode');
    await expect.element(setButton).toBeEnabled();
    await userEvent.click(setButton);

    expect(enableShuttersMock.request.variables).toHaveBeenCalledExactlyOnceWith({
      mode: { mode: 'FULLY_OPEN', aperture: null },
    });
  });

  it('sets a shutter mode that the server reports without an aperture', async () => {
    await renderBotSubsystems({
      shuttersMode: { __typename: 'ShutterMode', mode: 'TRACKING', aperture: null },
    });

    await expect.element(sut.getByTestId('set-shutter-mode')).toBeDisabled();
    await selectDropdownOption(sut, 'Select a Shutter Mode', 'Fully Open');

    const setButton = sut.getByTestId('set-shutter-mode');
    await expect.element(setButton).toBeEnabled();
    await userEvent.click(setButton);

    expect(enableShuttersMock.request.variables).toHaveBeenCalledExactlyOnceWith({
      mode: { mode: 'FULLY_OPEN', aperture: null },
    });
  });

  it('parks the dome', async () => {
    await renderBotSubsystems();

    await userEvent.click(sut.getByTestId('park-dome'));

    expect(domeParkMock.request.variables).toHaveBeenCalled();
  });

  it('parks the shutters', async () => {
    await renderBotSubsystems();

    await userEvent.click(sut.getByTestId('park-shutters'));

    expect(shuttersParkMock.request.variables).toHaveBeenCalled();
  });
});

/** Replace the contents of a number input, and commit it the way an operator would */
async function typeInto(input: Locator, value: string) {
  await userEvent.tripleClick(input);
  await userEvent.keyboard(`${value}{Enter}`);
}

function enclosureMocks(enclosure?: Partial<EnclosureState>): MockLink.MockedResponse[] {
  return [
    mechanismMock,
    telescopeStateMock(enclosure),
    telescopeStateSubscriptionMock(),
    moveWestVentGateMock,
    enableDomeMock,
    enableShuttersMock,
    domeParkMock,
    shuttersParkMock,
  ];
}

const mechanismMock = {
  request: {
    query: GET_MECHANISM,
    variables: {},
  },
  maxUsageCount: Infinity,
  result: { data: { mechanism: createMechanism() } },
} satisfies MockedResponseOf<typeof GET_MECHANISM>;

const telescopeStateMock = (enclosure?: Partial<EnclosureState>) =>
  ({
    request: {
      query: GET_TELESCOPE_STATE,
      variables: {},
    },
    maxUsageCount: Infinity,
    result: { data: { telescopeState: createTelescopeState({ enclosure }) } },
  }) satisfies MockedResponseOf<typeof GET_TELESCOPE_STATE>;

// The subscription never emits, so the query result is what the panel shows
const telescopeStateSubscriptionMock = (delay = Infinity) =>
  ({
    request: {
      query: TELESCOPE_STATE_SUBSCRIPTION,
      variables: {},
    },
    maxUsageCount: Infinity,
    delay,
    result: { data: { telescopeState: createTelescopeState() } },
  }) satisfies MockedResponseOf<typeof TELESCOPE_STATE_SUBSCRIPTION>;

const moveWestVentGateMock = {
  request: {
    query: ECS_MOVE_WEST_VENT_GATE_MUTATION,
    variables: vi.fn().mockReturnValue(true),
  },
  maxUsageCount: Infinity,
  result: { data: { ecsMoveWestVentGate: operationOutcome } },
} satisfies MockedResponseOf<typeof ECS_MOVE_WEST_VENT_GATE_MUTATION>;

const enableDomeMock = {
  request: {
    query: ECS_ENABLE_DOME_MUTATION,
    variables: vi.fn().mockReturnValue(true),
  },
  maxUsageCount: Infinity,
  result: { data: { ecsEnableDome: operationOutcome } },
} satisfies MockedResponseOf<typeof ECS_ENABLE_DOME_MUTATION>;

const enableShuttersMock = {
  request: {
    query: ECS_ENABLE_SHUTTERS_MUTATION,
    variables: vi.fn().mockReturnValue(true),
  },
  maxUsageCount: Infinity,
  result: { data: { ecsEnableShutters: operationOutcome } },
} satisfies MockedResponseOf<typeof ECS_ENABLE_SHUTTERS_MUTATION>;

const domeParkMock = {
  request: {
    query: ECS_DOME_PARK_MUTATION,
    variables: vi.fn().mockReturnValue(true),
  },
  maxUsageCount: Infinity,
  result: { data: { ecsDomePark: operationOutcome } },
} satisfies MockedResponseOf<typeof ECS_DOME_PARK_MUTATION>;

const shuttersParkMock = {
  request: {
    query: ECS_SHUTTERS_PARK_MUTATION,
    variables: vi.fn().mockReturnValue(true),
  },
  maxUsageCount: Infinity,
  result: { data: { ecsShuttersPark: operationOutcome } },
} satisfies MockedResponseOf<typeof ECS_SHUTTERS_PARK_MUTATION>;

const pwfs1ParkMock = {
  request: {
    query: PWFS1_PARK_MUTATION,
    variables: vi.fn().mockReturnValue({}),
  },
  result: {
    data: { pwfs1Park: operationOutcome },
  },
} satisfies MockedResponseOf<typeof PWFS1_PARK_MUTATION>;

const pwfs2ParkMock = {
  request: {
    query: PWFS2_PARK_MUTATION,
    variables: vi.fn().mockReturnValue({}),
  },
  result: {
    data: { pwfs2Park: operationOutcome },
  },
} satisfies MockedResponseOf<typeof PWFS2_PARK_MUTATION>;

const mountUnwrapMock = {
  request: {
    query: MOUNT_UNWRAP_MUTATION,
    variables: vi.fn().mockReturnValue({}),
  },
  result: {
    data: { mountUnwrap: operationOutcome },
  },
} satisfies MockedResponseOf<typeof MOUNT_UNWRAP_MUTATION>;

const rotatorUnwrapMock = {
  request: {
    query: ROTATOR_UNWRAP_MUTATION,
    variables: vi.fn().mockReturnValue({}),
  },
  result: {
    data: { rotatorUnwrap: operationOutcome },
  },
} satisfies MockedResponseOf<typeof ROTATOR_UNWRAP_MUTATION>;

const pwfs1UnwrapMock = {
  request: {
    query: PWFS1_UNWRAP_MUTATION,
    variables: vi.fn().mockReturnValue({}),
  },
  result: {
    data: { pwfs1Unwrap: operationOutcome },
  },
} satisfies MockedResponseOf<typeof PWFS1_UNWRAP_MUTATION>;

const pwfs2UnwrapMock = {
  request: {
    query: PWFS2_UNWRAP_MUTATION,
    variables: vi.fn().mockReturnValue({}),
  },
  result: {
    data: { pwfs2Unwrap: operationOutcome },
  },
} satisfies MockedResponseOf<typeof PWFS2_UNWRAP_MUTATION>;
