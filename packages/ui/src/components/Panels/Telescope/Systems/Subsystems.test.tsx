import {
  MOUNT_UNWRAP_MUTATION,
  PWFS1_PARK_MUTATION,
  PWFS1_UNWRAP_MUTATION,
  PWFS2_PARK_MUTATION,
  PWFS2_UNWRAP_MUTATION,
  ROTATOR_UNWRAP_MUTATION,
} from '@gql/server/park';
import type { MockedResponseOf } from '@gql/util';
import { userEvent } from 'vitest/browser';

import { operationOutcome } from '@/test/helpers';
import { type RenderResultWithStore, renderWithContext } from '@/test/render';

import { TopSubsystems } from './Subsystems';

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
