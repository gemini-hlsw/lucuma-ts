import { describe, expect, it } from 'vitest';

import { Probe, PROBE_URL_TESTID } from '@/test/probe';
import { renderApp } from '@/test/renderApp';

import { useUrlParam } from './useUrlParam';

const openView = async (route: string, options?: Parameters<typeof useUrlParam>[2]) =>
  renderApp({
    route,
    element: (
      <Probe
        use={() => useUrlParam('q', 'all', options)}
        readout={([value]) => ({ value })}
        actions={([, set]) => [
          { label: 'gpi', run: () => set('gpi') },
          { label: 'all', run: () => set('all') },
          { label: 'blank', run: () => set('') },
        ]}
      />
    ),
    mocks: [],
  });

describe(useUrlParam, () => {
  it('reads the parameter the URL carries', async () => {
    const screen = await openView('/instruments?q=gpi');

    await expect.element(screen.getByTestId('probe-value')).toHaveTextContent('gpi');
  });

  it('falls back when the URL names none, so a bare link is not a blank view', async () => {
    const screen = await openView('/instruments');

    await expect.element(screen.getByTestId('probe-value')).toHaveTextContent('all');
  });

  it('writes a chosen value into the URL, which is what makes the view linkable', async () => {
    const screen = await openView('/instruments');

    await screen.getByRole('button', { name: 'gpi' }).click();

    await expect.element(screen.getByTestId(PROBE_URL_TESTID)).toHaveTextContent('/instruments?q=gpi');
  });

  it('deletes the value rather than writing it when it equals the fallback', async () => {
    const screen = await openView('/instruments?q=gpi');

    await screen.getByRole('button', { name: 'all' }).click();

    // Not `?q=all`: two URLs for one state make a link say more than the sender chose.
    await expect.element(screen.getByTestId(PROBE_URL_TESTID)).toHaveTextContent('/instruments');
  });

  it('reads an empty value as the fallback too, so a cleared filter drops out of the URL', async () => {
    const screen = await openView('/instruments?q=gpi');

    await screen.getByRole('button', { name: 'blank' }).click();

    await expect.element(screen.getByTestId(PROBE_URL_TESTID)).toHaveTextContent('/instruments');
  });

  it('pushes history by default, so the back button undoes a change', async () => {
    const screen = await openView('/instruments');

    await screen.getByRole('button', { name: 'gpi' }).click();
    await expect.element(screen.getByTestId(PROBE_URL_TESTID)).toMatchTextContent('q=gpi');

    // The memory router's own history; `window.history.back()` would navigate the test page.
    await screen.router.navigate(-1);

    await expect.element(screen.getByTestId(PROBE_URL_TESTID)).toHaveTextContent('/instruments');
  });

  it('replaces history when asked, so a per-keystroke control does not bury the back button', async () => {
    const screen = await openView('/instruments', { replace: true });

    await screen.getByRole('button', { name: 'gpi' }).click();
    await expect.element(screen.getByTestId(PROBE_URL_TESTID)).toMatchTextContent('q=gpi');

    await screen.router.navigate(-1);

    await expect.element(screen.getByTestId(PROBE_URL_TESTID)).toMatchTextContent('q=gpi');
  });
});
