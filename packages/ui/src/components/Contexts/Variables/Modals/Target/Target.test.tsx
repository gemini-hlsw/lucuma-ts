import { GET_TARGETS, UPDATE_TARGET } from '@gql/configs/Target';
import type { MockedResponseOf } from '@gql/util';
import { page, userEvent } from 'vitest/browser';

import { odbTokenAtom } from '@/components/atoms/auth';
import { targetEditAtom } from '@/components/atoms/target';
import { createDeclination, createSidereal, createTarget } from '@/test/create';
import { expiredJwt } from '@/test/helpers';
import { renderWithContext } from '@/test/render';
import type { Target as TargetType } from '@/types';

import { Target } from './Target';

describe(Target.name, () => {
  const targetEditVisible = {
    isVisible: true,
    target: target,
  };

  it('should render', async () => {
    await renderWithContext(<Target />, {
      initialValues: [[targetEditAtom, targetEditVisible]],
      mocks: [getTargetsMock],
    });
    const dialog = page.getByRole('dialog');
    await expect.element(dialog).toBeVisible();
    await expect.element(dialog.getByText(`Edit target ${target.name}`)).toBeVisible();
    const name = dialog.getByLabelText('Name');
    await expect.element(name).toBeEnabled();
    await expect.element(name).toHaveValue(target.name);
    expect(dialog.getByRole('button', { name: 'Update' })).toBeEnabled();
  });

  it('should disable when canEdit=false', async () => {
    await renderWithContext(<Target />, {
      initialValues: [
        [targetEditAtom, targetEditVisible],
        [odbTokenAtom, expiredJwt],
      ],
      mocks: [getTargetsMock],
    });
    const dialog = page.getByRole('dialog');
    await expect.element(dialog.getByLabelText('Name')).toBeDisabled();
    expect(dialog.getByRole('button', { name: 'Update' })).toBeDisabled();
  });

  it('calls updateTarget mutation when updating', async () => {
    await renderWithContext(<Target />, {
      mocks: [updateTargetMock, getTargetsMock],
      initialValues: [[targetEditAtom, targetEditVisible]],
    });
    const dialog = page.getByRole('dialog');
    const nameInput = dialog.getByLabelText('Name');
    await userEvent.fill(nameInput, 'New Target Name');
    const updateButton = dialog.getByRole('button', { name: 'Update' });
    await userEvent.click(updateButton);

    expect(updateTargetMock.request.variables).toHaveBeenCalledExactlyOnceWith({
      ...target,
      name: 'New Target Name',
      sidereal: {
        coord1: 12.497148925,
        coord2: 41.69727150555556,
      },
    });
    await expect.element(dialog).not.toBeInTheDocument();
  });
});

const target: TargetType = createTarget({
  sidereal: createSidereal({
    dec: createDeclination({ degrees: 41.69727150555556, dms: '+41:41:50.177415' }),
  }),
});

const updateTargetMock = {
  request: {
    query: UPDATE_TARGET,
    variables: vi.fn().mockReturnValue(true),
  },
  result: (arg) => ({
    data: {
      updateTarget: createTarget({ ...target, ...arg } as TargetType),
    },
  }),
} satisfies MockedResponseOf<typeof UPDATE_TARGET>;

const getTargetsMock = {
  request: {
    query: GET_TARGETS,
    variables: {},
  },
  result: {
    data: {
      targets: [target],
    },
  },
} satisfies MockedResponseOf<typeof GET_TARGETS>;
