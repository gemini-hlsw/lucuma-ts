import { fakeJwt, standardUser } from '@gemini-hlsw/lucuma-common-ui/testing';
import { useAtomValue } from 'jotai';
import { type JSX, useState } from 'react';
import { Link, Outlet, useSearchParams } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';

import { signOut } from '@/auth/session';
import { odbTokenAtom, sessionCheckedAtom, useSessionStatus } from '@/components/atoms/auth';
import { Probe, PROBE_URL_TESTID } from '@/test/probe';
import { ssoLogout, stubSso } from '@/test/sso';

import { renderWithContext, renderWithRoute } from './render';

function SessionStatus(): JSX.Element {
  return <output>{useSessionStatus()}</output>;
}

const Status = <SessionStatus />;

function FirstPaint(): JSX.Element {
  const checked = useAtomValue(sessionCheckedAtom);
  const [first] = useState(checked);
  return <output>{first ? 'checked' : 'unchecked'}</output>;
}

beforeEach(() => {
  stubSso();
});

describe(renderWithContext, () => {
  it('should sign the tree in when the token atom is hydrated', async () => {
    const screen = await renderWithContext(Status, { initialValues: [[odbTokenAtom, fakeJwt(standardUser('staff'))]] });

    await expect.element(screen.getByRole('status')).toHaveTextContent('signed-in');
  });

  it('should start signed out when an earlier render in the test hydrated a token and storage was cleared', async () => {
    const first = await renderWithContext(Status, { initialValues: [[odbTokenAtom, fakeJwt(standardUser('staff'))]] });
    await expect.element(first.getByRole('status')).toHaveTextContent('signed-in');
    await first.unmount();
    sessionStorage.clear();

    const screen = await renderWithContext(Status);

    expect(screen.store.get(odbTokenAtom)).toBeNull();
    await expect.element(screen.getByRole('status')).toHaveTextContent('checking');
  });

  it('should sign the tree out when a real signOut runs on the returned store', async () => {
    const screen = await renderWithContext(Status, { initialValues: [[odbTokenAtom, fakeJwt(standardUser('staff'))]] });
    await expect.element(screen.getByRole('status')).toHaveTextContent('signed-in');

    const signedOut = signOut(screen.store);
    ssoLogout().answer({ status: 200 });
    expect(await signedOut).toEqual({ reachedSso: true });

    await expect.element(screen.getByRole('status')).toHaveTextContent('signed-out');
  });

  it('should give each render its own store when none is passed', async () => {
    const first = await renderWithContext(Status, { initialValues: [[sessionCheckedAtom, true]] });
    const second = await renderWithContext(Status);

    await expect.element(page.elementLocator(first.container).getByRole('status')).toHaveTextContent('signed-out');
    await expect.element(page.elementLocator(second.container).getByRole('status')).toHaveTextContent('checking');
    expect(second.store).not.toBe(first.store);
  });

  it('should hydrate the atoms before the first paint when initialValues are given', async () => {
    const screen = await renderWithContext(<FirstPaint />, { initialValues: [[sessionCheckedAtom, true]] });

    await expect.element(screen.getByRole('status')).toHaveTextContent('checked');
  });
});

const SearchProbe = (
  <Probe
    use={useSearchParams}
    actions={([, setSearchParams]) => [{ label: 'to GS', run: () => setSearchParams({ site: 'GS' }) }]}
  />
);

describe(renderWithRoute, () => {
  it('should report the URL it was given when the route carries a query string', async () => {
    const screen = await renderWithRoute(SearchProbe, { route: '/night?site=GN' });

    await expect.element(screen.getByTestId(PROBE_URL_TESTID)).toHaveTextContent('/night?site=GN');
    expect(screen.router.location.search).toBe('?site=GN');
  });

  it('should walk its own history when navigate(-1) follows a push', async () => {
    const screen = await renderWithRoute(SearchProbe, { route: '/night?site=GN' });

    await screen.getByRole('button', { name: 'to GS' }).click();
    await expect.poll(() => screen.router.location.search).toBe('?site=GS');
    expect(screen.router.navigationType).toBe('PUSH');

    await screen.router.navigate(-1);

    await expect.poll(() => screen.router.location.search).toBe('?site=GN');
    expect(screen.router.navigationType).toBe('POP');
  });

  it('should mount the subject at the pattern with its child routes when a link opens an extra route', async () => {
    const screen = await renderWithRoute(
      <>
        <Link to="/away">away</Link>
        <Outlet />
      </>,
      {
        route: '/home',
        path: '/',
        childRoutes: [{ path: 'home', element: <p>home page</p> }],
        extraRoutes: [{ path: '/away', element: <p>away page</p> }],
      },
    );
    await expect.element(screen.getByText('home page')).toBeVisible();

    await screen.getByRole('link', { name: 'away' }).click();

    await expect.element(screen.getByText('away page')).toBeVisible();
    await expect.poll(() => screen.router.location.pathname).toBe('/away');
  });
});
