import { describe, expect, it, vi } from 'vitest';

import type * as EnvironmentModule from '@/app/environment';
import { environmentLabel } from '@/app/environment';
import { renderApp } from '@/test/renderApp';

import { EnvBanner } from './EnvBanner';

// No hostname answers production yet (PRODUCTION_HOSTS is empty today), so the only way to reach
// EnvBanner's own null branch is to stub the one function it reads, never the hostname itself.
vi.mock('@/app/environment', async (importOriginal) => {
  const actual = await importOriginal<typeof EnvironmentModule>();
  return { environmentLabel: vi.fn(actual.environmentLabel) };
});

describe(EnvBanner, () => {
  it('names the environment, so nobody mistakes this for production', async () => {
    const screen = await renderApp({ element: <EnvBanner />, route: '/night' });

    await expect.element(screen.getByTestId('env-banner')).toHaveTextContent('Development');
  });

  it('renders nothing once the hostname is a production one', async () => {
    vi.mocked(environmentLabel).mockReturnValueOnce(null);

    const screen = await renderApp({ element: <EnvBanner />, route: '/night' });

    await expect.element(screen.getByTestId('env-banner')).not.toBeInTheDocument();
    expect(screen.container.textContent).toBe('');
  });
});
