import { fakeJwt, standardUser } from '@gemini-hlsw/lucuma-common-ui/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { CURRENT_ENV } from '@/app/environment';
import { odbTokenAtom } from '@/components/atoms/auth';
import { store } from '@/components/atoms/store';
import { ssoCall, ssoCalls, ssoLogout, stubSso } from '@/test/sso';

import { session } from './session';

// The keeper is tested in common-ui (session.test.ts). This covers Resource's binding.

let stop: (() => void) | undefined;

beforeEach(() => {
  stubSso();
});

afterEach(() => {
  stop?.();
  stop = undefined;
});

describe(session.start, () => {
  it("asks the environment's SSO and signs the app store in", async () => {
    stop = session.start();

    expect(ssoCalls()).toHaveLength(1);
    expect(ssoCall(0).url).toBe(`${CURRENT_ENV.ssoUri}/api/v1/refresh-token`);

    const token = fakeJwt(standardUser('staff'));
    const settled = session.pendingRefresh();
    ssoCall(0).answer({ body: token });
    await settled;

    expect(store.get(odbTokenAtom)).toBe(token);
  });

  it('switches no role, since any role may read Resource', () => {
    store.set(odbTokenAtom, fakeJwt({ ...standardUser('pi'), otherRoles: [{ type: 'staff', id: 'r-2' }] }));

    stop = session.start();

    expect(ssoCalls()).toHaveLength(0);
  });
});

describe(session.signOut, () => {
  it("ends the session at the environment's SSO", async () => {
    store.set(odbTokenAtom, fakeJwt(standardUser('staff')));
    stop = session.start();

    const signedOut = session.signOut();
    expect(ssoLogout().url).toBe(`${CURRENT_ENV.ssoUri}/api/v1/logout`);
    ssoLogout().answer({ status: 200 });

    expect(await signedOut).toEqual({ reachedSso: true });
    expect(store.get(odbTokenAtom)).toBeNull();
  });
});
