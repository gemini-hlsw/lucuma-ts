import { fakeJwt, standardUser } from '@gemini-hlsw/lucuma-common-ui/testing';
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';
import { userEvent } from 'vitest/browser';

import Layout from '@/components/layout/Layout';
import { renderWithContext } from '@/test/render';

import { AuthSession } from './AuthSession';

/** The SSO paths requested so far, in order. */
const requested = (fetchSpy: MockInstance<typeof fetch>) =>
  fetchSpy.mock.calls.map(([input]) => new URL(input instanceof Request ? input.url : input).pathname);

/** The session keeper with the masthead whose sign-out button users click. */
const renderApp = (token?: string) =>
  renderWithContext(
    <>
      <AuthSession />
      <Layout />
    </>,
    { token },
  );

describe(AuthSession, () => {
  let fetchSpy: MockInstance<typeof fetch>;

  beforeEach(() => {
    // SSO still holds the session cookie, so a refresh would mint a token.
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const path = new URL(input instanceof Request ? input.url : input).pathname;
      return Promise.resolve(
        path === '/api/v1/refresh-token' ? new Response(fakeJwt(standardUser('staff'))) : new Response(null),
      );
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renews an expired token on mount', async () => {
    await renderApp(fakeJwt(standardUser('staff'), -60));
    // Effects have run once render resolves; the proactive check's first tick is a second away.
    expect(requested(fetchSpy)).toEqual(['/api/v1/refresh-token']);
  });

  it('signs in silently on mount from the SSO cookie', async () => {
    const screen = await renderApp();
    await expect.element(screen.getByText('Ada Lovelace', { exact: false })).toBeInTheDocument();
    expect(requested(fetchSpy)).toEqual(['/api/v1/refresh-token']);
  });

  it('stays signed out after one sign-out click (sc-10853)', async () => {
    const screen = await renderApp(fakeJwt(standardUser('staff')));
    await userEvent.click(screen.getByTitle(/^Sign out/));

    // The name shares its element with the role badge, so match on part of the text.
    await expect.element(screen.getByText('Not signed in', { exact: false })).toBeInTheDocument();
    // The click's effects flush synchronously, so a silent sign-in racing the
    // logout would already have asked for a refresh by now.
    expect(requested(fetchSpy)).toEqual(['/api/v1/logout']);
  });
});
