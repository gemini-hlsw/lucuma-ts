import { fakeJwt } from '@gemini-hlsw/lucuma-common-ui/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { odbTokenAtom, sessionCheckedAtom, setToken } from '@/components/atoms/auth';
import { renderWithRoute } from '@/test/render';
import { staffToken } from '@/test/session';
import { ssoCalls, stubSso } from '@/test/sso';

import { SessionGateContainer } from './SessionGateContainer';

const ROUTE = '/night?site=GS&night=2025-11-14';
const PAGE = 'page';
const LOADING = 'Loading Resource…';
const SPLASH_HEADING = { level: 1, name: 'Sign in to read the schedule' };

const GUEST_PATH = '/api/v1/auth-as-guest';
const guestCalls = () => ssoCalls().filter((made) => made.url.includes(GUEST_PATH));

const openGate = ({ token, checked }: { token: string | null; checked: boolean }) =>
  renderWithRoute(
    <SessionGateContainer>
      <p>{PAGE}</p>
    </SessionGateContainer>,
    {
      route: ROUTE,
      initialValues: [
        [odbTokenAtom, token],
        [sessionCheckedAtom, checked],
      ],
    },
  );

const urlOf = (screen: Awaited<ReturnType<typeof openGate>>): string =>
  screen.router.location.pathname + screen.router.location.search;

beforeEach(() => {
  stubSso();
});

describe(SessionGateContainer, () => {
  it.each([
    ['the loading mark', 'the check is still running', null, false, LOADING],
    ['the splash', 'the check found no session', null, true, SPLASH_HEADING.name],
    ['the page', 'the check found a session', staffToken, true, PAGE],
  ])('should show %s, and nothing else, when %s', async (_, _when, token, checked, shown) => {
    const screen = await openGate({ token: token?.() ?? null, checked });

    await expect.element(screen.getByText(shown, { exact: true })).toBeVisible();
    for (const hidden of [LOADING, SPLASH_HEADING.name, PAGE].filter((text) => text !== shown)) {
      expect(screen.getByText(hidden, { exact: true }).query()).toBeNull();
    }
  });

  it('should open the page at the URL it was opened at when a signed-out reader continues as a guest', async () => {
    const screen = await openGate({ token: null, checked: true });
    await expect.element(screen.getByRole('heading', SPLASH_HEADING)).toBeVisible();

    await screen.getByRole('button', { name: 'Continue as Guest' }).click();
    await expect.poll(guestCalls).toHaveLength(1);
    guestCalls()[0]?.answer({ body: fakeJwt({ type: 'guest', id: 'u-guest' }) });

    await expect.element(screen.getByText(PAGE, { exact: true })).toBeVisible();
    expect(screen.getByRole('heading', SPLASH_HEADING).query()).toBeNull();
    expect(urlOf(screen)).toBe(ROUTE);
  });

  it('should return to the splash at the same URL when a signed-in session ends', async () => {
    const screen = await openGate({ token: staffToken(), checked: true });
    await expect.element(screen.getByText(PAGE, { exact: true })).toBeVisible();

    setToken(screen.store, null);

    await expect.element(screen.getByRole('heading', SPLASH_HEADING)).toBeVisible();
    expect(screen.getByText(PAGE, { exact: true }).query()).toBeNull();
    expect(urlOf(screen)).toBe(ROUTE);
  });
});
