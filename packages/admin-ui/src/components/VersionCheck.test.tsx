import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderWithContext } from '@/test/render';

import { VersionCheck } from './VersionCheck';

const RUNNING = '20260916-fe82b0d';
const DEPLOYED = '20260917-abcdef1';

/** Renders with the poll effectively parked, so a test sees only the startup
 *  check unless it asks for a faster interval to observe repeat polls. */
function render(deployed: string | undefined, running = RUNNING, pollIntervalMs = 10_000) {
  const fetchDeployed = vi.fn().mockResolvedValue(deployed);
  return {
    fetchDeployed,
    screen: renderWithContext(
      <VersionCheck running={running} fetchDeployed={fetchDeployed} enabled={true} pollIntervalMs={pollIntervalMs} />,
    ),
  };
}

function occurrences(haystack: string | null, needle: string): number {
  return haystack === null ? 0 : haystack.split(needle).length - 1;
}

/** Holds VersionCheck mounted while changing a prop the effect depends on, so
 *  the effect tears down and re-runs against the same Toast instance.
 *  `slowMs` delays the fetch so a reconfigure can land mid-flight, and the fetch
 *  ignores the abort signal — which a caller-supplied one is free to do. */
function Reconfigurable({ slowMs = 0 }: { readonly slowMs?: number }) {
  const [pollIntervalMs, setPollIntervalMs] = useState(10_000);
  return (
    <>
      <button onClick={() => setPollIntervalMs((ms) => ms + 1)}>reconfigure</button>
      <VersionCheck
        running={RUNNING}
        fetchDeployed={() => new Promise((resolve) => setTimeout(() => resolve(DEPLOYED), slowMs))}
        enabled={true}
        pollIntervalMs={pollIntervalMs}
      />
    </>
  );
}

describe(VersionCheck, () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('offers the upgrade when a newer build is deployed', async () => {
    const { screen } = render(DEPLOYED);

    await expect.element((await screen).getByText(/A new version of/)).toBeInTheDocument();
    await expect.element((await screen).getByRole('button', { name: 'Upgrade' })).toBeInTheDocument();
  });

  it('links the range between the running build and the one being offered', async () => {
    // Not `...HEAD` (which Explore uses, having no deployed version to name):
    // HEAD is whatever main is when the link is clicked, so it would overstate
    // what the upgrade actually contains.
    const { screen } = render(DEPLOYED);

    const link = (await screen).getByRole('link', { name: 'Admin' });
    await expect
      .element(link)
      .toHaveAttribute('href', 'https://github.com/gemini-hlsw/lucuma-ts/compare/fe82b0d...abcdef1');
  });

  it.each([
    ['the deployed build is the running one', RUNNING],
    // Offline, or the host answering with index.html instead of version.json.
    ['the deployed version cannot be read', undefined],
  ])('stays quiet when %s', async (_case, deployed) => {
    // Waiting for a SECOND poll is what makes this assertion mean anything. The
    // prompt appears in the continuation after a fetch resolves, so asserting
    // absence any earlier — including right after the first fetch settles —
    // only says "not yet", which is equally true of a component that announces
    // a moment later. A second call cannot happen until the first check has run
    // to completion, so by then an announcement would already be on screen.
    const { screen, fetchDeployed } = render(deployed, RUNNING, 20);
    const rendered = await screen;

    await vi.waitFor(() => {
      expect(fetchDeployed.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    await expect.element(rendered.getByText(/A new version of/)).not.toBeInTheDocument();
  });

  it('does not check at all when disabled', async () => {
    const fetchDeployed = vi.fn().mockResolvedValue(DEPLOYED);
    const screen = await renderWithContext(
      <VersionCheck running={RUNNING} fetchDeployed={fetchDeployed} enabled={false} />,
    );

    expect(fetchDeployed).not.toHaveBeenCalled();
    await expect.element(screen.getByText(/A new version of/)).not.toBeInTheDocument();
  });

  it('offers a build once, however many times it polls', async () => {
    // The prompt is dismissible, so re-raising it on each poll would override
    // the user's answer — every five minutes, for as long as the tab is open.
    const { screen, fetchDeployed } = render(DEPLOYED, RUNNING, 20);
    const rendered = await screen;

    await expect.element(rendered.getByText(/A new version of/)).toBeInTheDocument();
    await vi.waitFor(() => {
      expect(fetchDeployed.mock.calls.length).toBeGreaterThanOrEqual(4);
    });

    expect(occurrences(document.body.textContent, 'A new version of')).toBe(1);
  });

  it('replaces its prompt rather than stacking a second one when the poll is reconfigured', async () => {
    // The effect's cleanup clears the outlet. Unmounting cannot show this —
    // React tears the Toast down anyway, so the prompt goes either way — but a
    // dependency change re-runs the effect against the *same* live Toast, and
    // without the clear the re-run's check adds a second copy on top of the
    // first. Asserted on the document, since the Toast renders into a portal
    // outside the render container.
    const rendered = await renderWithContext(<Reconfigurable />);
    await expect.element(rendered.getByText(/A new version of/)).toBeInTheDocument();

    await rendered.getByRole('button', { name: 'reconfigure' }).click();

    // Settled, not sampled. `expect.poll` would stop at its first reading of 1,
    // which is momentarily true after the click and before the re-run's fetch
    // resolves and shows again — so it passed against a missing `clear` four
    // times in five. Letting the re-run's check land first is what makes the
    // count mean anything.
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(occurrences(document.body.textContent, 'A new version of')).toBe(1);
  });

  it('leaves the prompt up rather than letting it time out unanswered', async () => {
    // PrimeReact dismisses a toast after `life || 3000` unless it is sticky, and
    // an upgrade offer that disappears on its own is one the user never gets to
    // answer.
    //
    // Waited out for real rather than with fake timers, which CLAUDE.md would
    // otherwise prefer for a never-fires assertion: the Toast installs its
    // dismissal with the real setTimeout when it mounts, and its removal needs a
    // React commit, so an advanced fake clock drives neither — verified, the
    // fake-timer form passes even with `sticky` deleted.
    const { screen } = render(DEPLOYED);
    const rendered = await screen;
    await expect.element(rendered.getByText(/A new version of/)).toBeInTheDocument();

    // Past the 3s window and the dismissal animation that follows it.
    await new Promise((resolve) => setTimeout(resolve, 3_600));

    expect(occurrences(document.body.textContent, 'A new version of')).toBe(1);
  });

  it('does not raise a prompt from a check the cleanup already overtook', async () => {
    // A check still in flight when its effect is torn down must not announce:
    // the cleanup has cleared the outlet, so a late show() resurrects a prompt
    // belonging to a run that is over. The signal alone cannot prevent this —
    // `fetchDeployed` is a prop, and an implementation is free to ignore it.
    const rendered = await renderWithContext(<Reconfigurable slowMs={200} />);

    await rendered.getByRole('button', { name: 'reconfigure' }).click();

    await expect.poll(() => occurrences(document.body.textContent, 'A new version of')).toBe(1);
    // Held, not merely sampled: the overtaken check resolves a beat later, and
    // the count must still be 1 once it has.
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(occurrences(document.body.textContent, 'A new version of')).toBe(1);
  });
});
