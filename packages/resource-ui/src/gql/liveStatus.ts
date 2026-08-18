/**
 * Whether the live server is answering, for the banner that says so.
 *
 * The app reads one backend: the Resource service at `/resource/graphql`. It
 * does not serve the v1 API yet, so the link watches for failure and reports it
 * here in words a tester can act on, and `LiveFailureBanner` renders whatever is
 * standing.
 *
 * This module was `dataSource.ts` and carried a demo/live toggle until
 * 2026-08-14 (Hugo's review). The demo executed the mock schema in the browser,
 * which meant shipping graphql-yoga, an executable schema and the SDL in the
 * app - server-side machinery in a frontend bundle. It went, and the toggle
 * with it: an app with one backend should not carry a control for choosing
 * between two. The mock still backs the browser tests and the dev GraphQL
 * server on :4000; it is simply no longer something the app can be pointed at.
 *
 * A module-level store rather than React state: the Apollo link that reports
 * failures is constructed before React renders, and every subscriber (the one
 * banner) should see the same value.
 */
import { useSyncExternalStore } from 'react';

let liveFailure: string | null = null;
const listeners = new Set<() => void>();

const setLiveFailure = (failure: string | null): void => {
  if (liveFailure === failure) {
    return;
  }
  liveFailure = failure;
  for (const listener of listeners) {
    listener();
  }
};

export const reportLiveFailure = (message: string): void => {
  setLiveFailure(message);
};

/**
 * Forgets the last failure, so the banner names a situation the app is still
 * in rather than one it recovered from.
 *
 * The live link calls this on every answer that carries no error: a transient
 * failure - the dev deployment restarting, a lost connection - would otherwise
 * pin the banner for the rest of the session, telling a tester the server is
 * unreachable while it answers every query.
 */
export const clearLiveFailure = (): void => {
  setLiveFailure(null);
};

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** The live link's last failure, or null while everything answers. */
export const useLiveFailure = (): string | null => useSyncExternalStore(subscribe, () => liveFailure);
