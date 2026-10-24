import { vi } from 'vitest';

import { fakeJwt, standardUser } from './factories';

/**
 * SSO as lucuma-odb's sso-service behaves (Routes.scala): `refresh-token` answers with a fresh JWT for any
 * request that still carries the session cookie; `logout` does not end the session on the server, it only
 * clears the cookie in the browser when its response arrives. Here the logout is held until the test lets it
 * go, so the time between the click and SSO's answer can be examined.
 */
export class FakeSso {
  cookie = true;
  refreshes = 0;
  logouts = 0;
  failLogout = false;
  private release: () => void = () => undefined;
  private readonly answer = new Promise<void>((resolve) => {
    this.release = resolve;
  });

  answerLogout = (): void => {
    this.release();
  };

  fetch = async (input: URL | string): Promise<Response> => {
    const path = new URL(input).pathname;
    if (path.endsWith('/refresh-token')) {
      this.refreshes += 1;
      return this.cookie
        ? new Response(fakeJwt(standardUser('staff')))
        : new Response('Not logged in.', { status: 403 });
    }
    if (path.endsWith('/logout')) {
      this.logouts += 1;
      await this.answer;
      if (this.failLogout) throw new Error('SSO unreachable');
      this.cookie = false;
      return new Response('Logged out.');
    }
    return new Response('', { status: 404 });
  };
}

/** Stubs `fetch` with a fresh FakeSso (undo with `vi.unstubAllGlobals()`). */
export function stubSso(): FakeSso {
  const sso = new FakeSso();
  vi.stubGlobal('fetch', sso.fetch);
  return sso;
}
