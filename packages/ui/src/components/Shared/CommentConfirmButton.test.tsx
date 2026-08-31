import type { Mock } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';

import { CommentConfirmButton } from './CommentConfirmButton';

describe(CommentConfirmButton, () => {
  let onConfirm: Mock;
  beforeEach(() => {
    onConfirm = vi.fn();
  });

  it('should render', async () => {
    const sut = await render(<CommentConfirmButton message="Message" tooltip="Tooltip" onConfirm={onConfirm} />);

    expect(sut.getByRole('button')).toBeVisible();
    expect(sut.getByRole('button')).not.toBeDisabled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('renders disabled button', async () => {
    const sut = await render(
      <CommentConfirmButton message="Message" tooltip="Tooltip" onConfirm={onConfirm} disabled />,
    );

    expect(sut.getByRole('button')).toBeDisabled();
  });

  it('shows comment text area when clicked', async () => {
    const sut = await render(<CommentConfirmButton message="Message" tooltip="Tooltip" onConfirm={onConfirm} />);

    await userEvent.click(sut.getByRole('button'));

    await expect.element(page.getByRole('textbox')).toBeVisible();
  });

  it('calls onConfirm with comment when confirmed', async () => {
    const sut = await render(<CommentConfirmButton message="Message" tooltip="Tooltip" onConfirm={onConfirm} />);

    await userEvent.click(sut.getByRole('button', { name: 'Tooltip' }));

    const commentBox = page.getByRole('textbox');
    await userEvent.fill(commentBox, 'This is a comment');

    const confirmButton = page.getByRole('button', { name: 'Save' });
    await userEvent.click(confirmButton);

    expect(onConfirm).toHaveBeenCalledWith('This is a comment');
    await expect.element(commentBox).not.toBeInTheDocument();
  });

  it('calls onConfirm with null when confirmed without comment', async () => {
    const sut = await render(<CommentConfirmButton message="Message" tooltip="Tooltip" onConfirm={onConfirm} />);

    await userEvent.click(sut.getByRole('button', { name: 'Tooltip' }));

    const confirmButton = page.getByRole('button', { name: 'Save' });
    await userEvent.click(confirmButton);

    expect(onConfirm).toHaveBeenCalledWith(null);
  });

  it('closes when clicking cancel', async () => {
    const sut = await render(<CommentConfirmButton message="Message" tooltip="Tooltip" onConfirm={onConfirm} />);

    await userEvent.click(sut.getByRole('button', { name: 'Tooltip' }));

    const commentBox = page.getByRole('textbox');
    await expect.element(commentBox).toBeVisible();

    const cancelButton = page.getByRole('button', { name: 'Cancel' });
    await userEvent.click(cancelButton);

    await expect.element(commentBox).not.toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
