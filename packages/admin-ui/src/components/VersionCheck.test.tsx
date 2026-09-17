import { describe, expect, it, vi } from 'vitest';

import { renderWithContext } from '@/test/render';

import { VersionCheck } from './VersionCheck';

const RUNNING = '20260916-fe82b0d';
const DEPLOYED = '20260917-abcdef1';

/** Renders with the poll disabled after the first check, so each test exercises
 *  the startup check without a timer running behind the assertions. */
function render(deployed: string | undefined, running = RUNNING) {
  const fetchDeployed = vi.fn().mockResolvedValue(deployed);
  return {
    fetchDeployed,
    screen: renderWithContext(
      <VersionCheck running={running} fetchDeployed={fetchDeployed} enabled={true} pollIntervalMs={10_000} />,
    ),
  };
}

describe(VersionCheck, () => {
  it('offers the upgrade when a newer build is deployed', async () => {
    const { screen } = render(DEPLOYED);

    await expect.element((await screen).getByText(/A new version of/)).toBeInTheDocument();
    await expect.element((await screen).getByRole('button', { name: 'Upgrade' })).toBeInTheDocument();
  });

  it('links to what changed since the running build', async () => {
    const { screen } = render(DEPLOYED);

    const link = (await screen).getByRole('link', { name: 'Admin' });
    await expect
      .element(link)
      .toHaveAttribute('href', 'https://github.com/gemini-hlsw/lucuma-ts/compare/fe82b0d...HEAD');
  });

  it('stays quiet when the deployed build is the running one', async () => {
    const { screen, fetchDeployed } = render(RUNNING);

    await vi.waitFor(() => {
      expect(fetchDeployed).toHaveBeenCalled();
    });
    expect((await screen).container.querySelector('.p-toast-message')).toBeNull();
  });

  it('stays quiet when the deployed version cannot be read', async () => {
    // Offline, or the host answering with index.html instead of version.json.
    const { screen, fetchDeployed } = render(undefined);

    await vi.waitFor(() => {
      expect(fetchDeployed).toHaveBeenCalled();
    });
    expect((await screen).container.querySelector('.p-toast-message')).toBeNull();
  });

  it('does not check at all when disabled', async () => {
    const fetchDeployed = vi.fn().mockResolvedValue(DEPLOYED);
    const screen = await renderWithContext(
      <VersionCheck running={RUNNING} fetchDeployed={fetchDeployed} enabled={false} />,
    );

    expect(fetchDeployed).not.toHaveBeenCalled();
    expect(screen.container.querySelector('.p-toast-message')).toBeNull();
  });
});
