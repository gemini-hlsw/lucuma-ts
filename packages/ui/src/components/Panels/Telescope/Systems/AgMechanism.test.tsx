import {
  AG_ALL_PARK_MUTATION,
  AG_AO_FOLD_PARK_MUTATION,
  AG_PICKOFF_MIRROR_PARK_MUTATION,
  AG_SCIENCE_FOLD_PARK_MUTATION,
} from '@gql/server/AgMechanism';
import type { MockedResponseOf } from '@gql/util';
import { userEvent } from 'vitest/browser';

import { operationOutcome } from '@/test/helpers';
import { type RenderResultWithStore, renderWithContext } from '@/test/render';

import { AgMechanism } from './AgMechanism';

describe(AgMechanism.name, () => {
  let sut: RenderResultWithStore;
  beforeEach(async () => {
    sut = await renderWithContext(<AgMechanism canEdit={true} />, {
      mocks: [scienceFoldParkMock, aoFoldParkMock, pickoffMirrorParkMock, allParkMock],
    });
  });

  it('should render', async () => {
    await expect.element(sut.baseElement).toBeVisible();
    expect(sut.getByTestId('park-science-fold')).toBeVisible();
    expect(sut.getByTestId('park-ao-fold')).toBeVisible();
    expect(sut.getByTestId('park-ac-pickoff')).toBeVisible();
    expect(sut.getByTestId('park-all-ag')).toBeVisible();
  });

  it('science fold park button calls mutation', async () => {
    const button = sut.getByTestId('park-science-fold');
    await userEvent.click(button);

    expect(scienceFoldParkMock.request.variables).toHaveBeenCalled();
  });

  it('ao fold park button calls mutation', async () => {
    const button = sut.getByTestId('park-ao-fold');
    await userEvent.click(button);

    expect(aoFoldParkMock.request.variables).toHaveBeenCalled();
  });

  it('ac pickoff park button calls mutation', async () => {
    const button = sut.getByTestId('park-ac-pickoff');
    await userEvent.click(button);

    expect(pickoffMirrorParkMock.request.variables).toHaveBeenCalled();
  });

  it('park all button calls mutation', async () => {
    const button = sut.getByTestId('park-all-ag');
    await userEvent.click(button);

    expect(allParkMock.request.variables).toHaveBeenCalled();
  });
});

const scienceFoldParkMock = {
  request: {
    query: AG_SCIENCE_FOLD_PARK_MUTATION,
    variables: vi.fn().mockReturnValue(true),
  },
  result: {
    data: { agScienceFoldPark: operationOutcome },
  },
} satisfies MockedResponseOf<typeof AG_SCIENCE_FOLD_PARK_MUTATION>;

const aoFoldParkMock = {
  request: {
    query: AG_AO_FOLD_PARK_MUTATION,
    variables: vi.fn().mockReturnValue(true),
  },
  result: {
    data: { agAoFoldPark: operationOutcome },
  },
} satisfies MockedResponseOf<typeof AG_AO_FOLD_PARK_MUTATION>;

const pickoffMirrorParkMock = {
  request: {
    query: AG_PICKOFF_MIRROR_PARK_MUTATION,
    variables: vi.fn().mockReturnValue(true),
  },
  result: {
    data: { agPickoffMirrorPark: operationOutcome },
  },
} satisfies MockedResponseOf<typeof AG_PICKOFF_MIRROR_PARK_MUTATION>;

const allParkMock = {
  request: {
    query: AG_ALL_PARK_MUTATION,
    variables: vi.fn().mockReturnValue(true),
  },
  result: {
    data: { agAllPark: operationOutcome },
  },
} satisfies MockedResponseOf<typeof AG_ALL_PARK_MUTATION>;
