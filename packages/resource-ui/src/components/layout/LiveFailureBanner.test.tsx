/**
 * The live-failure banner: what a tester sees when the server does not answer.
 *
 * The failure store is real here - it is a module-level store, not React state,
 * because the Apollo link that reports failures is built before React renders.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-react';

import { clearLiveFailure, reportLiveFailure } from '@/gql/liveStatus';

import { LiveFailureBanner } from './LiveFailureBanner';

describe(LiveFailureBanner.name, () => {
  beforeEach(() => {
    clearLiveFailure();
  });

  it('says what went wrong, in the words the link phrased it in', async () => {
    // The failure lands before the banner mounts - the page-load case; the
    // store's reactivity is pinned in liveStatus.test.ts.
    reportLiveFailure('The live server could not be reached (Failed to fetch).');
    const screen = await render(<LiveFailureBanner />);

    await expect.element(screen.getByTestId('live-failure-banner')).toBeVisible();
    await expect.element(screen.getByText('could not be reached', { exact: false })).toBeVisible();
  });

  it('stays out of the way while the server answers', async () => {
    const screen = await render(<LiveFailureBanner />);

    await expect.element(screen.getByTestId('live-failure-banner')).not.toBeInTheDocument();
  });

  it('offers no way to a second source - there is one backend', async () => {
    reportLiveFailure('The live server could not be reached.');
    const screen = await render(<LiveFailureBanner />);

    await expect.element(screen.getByTestId('live-failure-banner')).toBeVisible();
    await expect.element(screen.getByRole('button')).not.toBeInTheDocument();
  });
});
