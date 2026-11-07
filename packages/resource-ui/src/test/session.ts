import { fakeJwt, standardUser } from '@gemini-hlsw/lucuma-common-ui/testing';
import { expect } from 'vitest';

import { SESSION_CHANNEL, SESSION_TIMINGS, type SessionTimings, SIGNED_OUT_MESSAGE } from '@/auth/session';

import { answerRefresh, ssoRefreshes } from './sso';

/** A function, so each token's `exp` counts from the moment the test asks for it. */
export const staffToken = (): string => fakeJwt(standardUser('staff'));

/** Renews a sixty-second token at once, so the refusal and not the token's own expiry ends the session. */
export const RENEW_AT_ONCE = { ...SESSION_TIMINGS, refreshAheadMs: 60_000 } as const satisfies SessionTimings;

export async function refuseRefresh(): Promise<void> {
  await expect.poll(() => ssoRefreshes().length).toBe(1);
  await answerRefresh(0, { status: 403 });
}

/** Resolves once the message has arrived: a channel opened after the session keeper's hears it after the keeper has. */
export async function announceFromOtherTab(): Promise<void> {
  const otherTab = new BroadcastChannel(SESSION_CHANNEL);
  const witness = new BroadcastChannel(SESSION_CHANNEL);
  const delivered = new Promise<void>((resolve) => {
    witness.addEventListener('message', () => resolve(), { once: true });
  });
  otherTab.postMessage(SIGNED_OUT_MESSAGE);
  await delivered;
  witness.close();
  otherTab.close();
}
