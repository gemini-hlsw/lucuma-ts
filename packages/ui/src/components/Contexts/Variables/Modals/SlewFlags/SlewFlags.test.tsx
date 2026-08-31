import { page } from 'vitest/browser';

import { odbTokenAtom } from '@/components/atoms/auth';
import { slewVisibleAtom } from '@/components/atoms/slew';
import { expiredJwt } from '@/test/helpers';
import { renderWithContext } from '@/test/render';

import { SlewFlags } from './SlewFlags';

describe(SlewFlags, () => {
  it('should render', async () => {
    await renderWithContext(<SlewFlags />, { initialValues: [[slewVisibleAtom, true]] });

    await expect.element(page.getByText('Zero Chop Throw')).toBeEnabled();
    expect(page.getByRole('checkbox').elements()).toHaveLength(16);
  });

  it('should disable when canEdit=false', async () => {
    await renderWithContext(<SlewFlags />, {
      initialValues: [
        [slewVisibleAtom, true],
        [odbTokenAtom, expiredJwt],
      ],
    });

    await expect.element(page.getByLabelText('Zero Chop Throw')).toBeDisabled();
  });
});
