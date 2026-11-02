import { describe, expect, it } from 'vitest';

import { renderApp } from '@/test/renderApp';

import { EnvBanner } from './EnvBanner';

describe(EnvBanner, () => {
  it('names the environment, so nobody mistakes this for production', async () => {
    const screen = await renderApp({ element: <EnvBanner />, route: '/night', mocks: [] });

    await expect.element(screen.getByTestId('env-banner')).toHaveTextContent('Development');
  });

  it('should render nothing when the hostname is the production serving', async () => {
    const screen = await renderApp({
      element: <EnvBanner hostname="resource.gemini.edu" />,
      route: '/night',
      mocks: [],
    });

    await expect.element(screen.getByTestId('env-banner')).not.toBeInTheDocument();
    expect(screen.container.textContent).toBe('');
  });
});
