import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-react';

import type { SessionStatus } from '@/components/atoms/auth';

import { SessionGate } from './SessionGate';

const gate = (status: SessionStatus, hostname?: string) => (
  <SessionGate status={status} splash={<p>The splash</p>} {...(hostname === undefined ? {} : { hostname })}>
    <p>The page</p>
  </SessionGate>
);

describe(SessionGate, () => {
  it('should show only the loading mark under the banner when the check is still running', async () => {
    const screen = await render(gate('checking'));

    await expect.element(screen.getByText('Loading Resource…')).toBeVisible();
    await expect.element(screen.getByTestId('env-banner')).toBeVisible();
    expect(screen.getByText('The splash').query()).toBeNull();
    expect(screen.getByText('The page').query()).toBeNull();
  });

  it('should show the splash and not the page when the reader is signed out', async () => {
    const screen = await render(gate('signed-out'));

    await expect.element(screen.getByText('The splash')).toBeVisible();
    expect(screen.getByText('The page').query()).toBeNull();
    expect(screen.getByText('Loading Resource…').query()).toBeNull();
  });

  it('should show the page and not the splash when the reader is signed in', async () => {
    const screen = await render(gate('signed-in'));

    await expect.element(screen.getByText('The page')).toBeVisible();
    expect(screen.getByText('The splash').query()).toBeNull();
    expect(screen.getByText('Loading Resource…').query()).toBeNull();
  });

  it('should draw the environment banner above the splash when off the production hostname', async () => {
    const screen = await render(gate('signed-out'));

    await expect.element(screen.getByTestId('env-banner')).toHaveTextContent('Development');
  });

  it('should draw no environment banner above the splash when on the production hostname', async () => {
    const screen = await render(gate('signed-out', 'resource.gemini.edu'));

    await expect.element(screen.getByText('The splash')).toBeVisible();
    expect(screen.getByTestId('env-banner').query()).toBeNull();
  });
});
