import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-react';

import { SessionNotices } from './SessionNotices';

describe(SessionNotices, () => {
  it('should show the announcement in a status live region when it is given one', async () => {
    const screen = await render(<SessionNotices announcement="Logged out" />);

    await expect.element(screen.getByRole('status')).toHaveTextContent('Logged out');
  });

  it('should keep the status live region in place when there is nothing to announce', async () => {
    const screen = await render(<SessionNotices announcement="" />);

    await expect.element(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByRole('status').element().textContent).toBe('');
  });
});
