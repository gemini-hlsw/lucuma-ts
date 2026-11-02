import { describe, expect, it } from 'vitest';

import { renderWithContext } from '@/test/render';

import { EnvBanner } from './EnvBanner';

describe(EnvBanner, () => {
  it('names the environment, so nobody mistakes this for production', async () => {
    const screen = await renderWithContext(<EnvBanner />);

    await expect.element(screen.getByTestId('env-banner')).toHaveTextContent('Development');
  });

  it('should render nothing when the hostname is the production serving', async () => {
    const screen = await renderWithContext(<EnvBanner hostname="resource.gemini.edu" />);

    await expect.element(screen.getByTestId('env-banner')).not.toBeInTheDocument();
    expect(screen.container.textContent).toBe('');
  });
});
