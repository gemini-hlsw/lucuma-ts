/**
 * `useUrlParam`, driven through the URL it exists to own.
 *
 * The contract has three halves and each one had a bug behind it: a default is
 * *deleted* rather than written, so a link carries only what was actually
 * chosen; a subordinate parameter is dropped in the *same* update, so the URL
 * never holds a half-changed state; and `replace` keeps a per-keystroke control
 * out of the back button's way.
 */
import { describe, expect, it } from 'vitest';

import { Probe, PROBE_URL_TESTID } from '@/test/probe';
import { renderApp } from '@/test/renderApp';

import { useUrlParam } from './useUrlParam';

const openView = async (route: string, options?: Parameters<typeof useUrlParam>[2]) =>
  renderApp({
    route,
    element: (
      <Probe
        use={() => useUrlParam('view', 'chart', options)}
        readout={([value]) => ({ value })}
        actions={([, set]) => [
          { label: 'calendar', run: () => set('calendar') },
          { label: 'chart', run: () => set('chart') },
          { label: 'blank', run: () => set('') },
        ]}
      />
    ),
  });

describe(useUrlParam.name, () => {
  it('reads the parameter the URL carries', async () => {
    const screen = await openView('/semester?view=calendar');

    await expect.element(screen.getByTestId('probe-value')).toHaveTextContent('calendar');
  });

  it('falls back when the URL names none, so a bare link is not a blank view', async () => {
    const screen = await openView('/semester');

    await expect.element(screen.getByTestId('probe-value')).toHaveTextContent('chart');
  });

  it('writes a chosen value into the URL, which is what makes the view linkable', async () => {
    const screen = await openView('/semester');

    await screen.getByRole('button', { name: 'calendar' }).click();

    await expect.element(screen.getByTestId(PROBE_URL_TESTID)).toHaveTextContent('/semester?view=calendar');
  });

  it('deletes the value rather than writing it when it equals the fallback', async () => {
    const screen = await openView('/semester?view=calendar');

    await screen.getByRole('button', { name: 'chart' }).click();

    // Not `?view=chart`: a default in the URL is noise, and two URLs for one
    // state make a link say more than the sender chose.
    await expect.element(screen.getByTestId(PROBE_URL_TESTID)).toHaveTextContent('/semester');
    await expect.element(screen.getByTestId(PROBE_URL_TESTID)).not.toHaveTextContent('view');
  });

  it('reads an empty value as the fallback too, so a cleared filter drops out of the URL', async () => {
    const screen = await openView('/semester?view=calendar');

    await screen.getByRole('button', { name: 'blank' }).click();

    await expect.element(screen.getByTestId(PROBE_URL_TESTID)).not.toHaveTextContent('view');
  });

  it('clears its subordinate parameters in the same update, never leaving a half-changed URL', async () => {
    // The standing example: `month` names a page of the calendar, so a link to
    // the chart must not carry one. One update, so no render sees the pair
    // disagreeing.
    const screen = await openView('/semester?view=calendar&month=2026-11', { clears: ['month'] });

    await screen.getByRole('button', { name: 'chart' }).click();

    await expect.element(screen.getByTestId(PROBE_URL_TESTID)).toHaveTextContent('/semester');
    await expect.element(screen.getByTestId(PROBE_URL_TESTID)).not.toHaveTextContent('month');
  });

  it('pushes history by default, so the back button undoes a view switch', async () => {
    const screen = await openView('/semester');

    await screen.getByRole('button', { name: 'calendar' }).click();
    await expect.element(screen.getByTestId(PROBE_URL_TESTID)).toHaveTextContent('view=calendar');

    // The memory router's own history - `window.history.back()` would navigate
    // the test page itself.
    await screen.router.navigate(-1);

    await expect.element(screen.getByTestId(PROBE_URL_TESTID)).not.toHaveTextContent('view');
  });

  it('replaces history when asked, so a per-keystroke control does not bury the back button', async () => {
    const screen = await openView('/semester', { replace: true });

    await screen.getByRole('button', { name: 'calendar' }).click();
    await expect.element(screen.getByTestId(PROBE_URL_TESTID)).toHaveTextContent('view=calendar');

    await screen.router.navigate(-1);

    // The entry was replaced, so back leaves the parameter where it is rather
    // than stepping through every intermediate value.
    await expect.element(screen.getByTestId(PROBE_URL_TESTID)).toHaveTextContent('view=calendar');
  });
});
