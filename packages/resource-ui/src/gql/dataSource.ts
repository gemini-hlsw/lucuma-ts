/**
 * Which backend the app reads: the built-in demo data, or the live server.
 *
 * ## Why a toggle
 *
 * The live Resource service does not serve the v1 API yet, but the app has a
 * complete, deterministic mock - the same executable schema the browser tests
 * run against. Serving that mock *in the browser* (Apollo `SchemaLink`) means
 * a deployed build works with no backend at all, which is what public testing
 * needs today; the toggle is how a tester flips to the live server the moment
 * it exists, and how they get back when it fails.
 *
 * ## Why a reload on switch
 *
 * The choice is read once, when the Apollo client is constructed. Swapping the
 * link inside a live client would leave the cache holding a mix of two
 * backends' answers; a reload gives the new source a clean client, a clean
 * cache and no mixed state, at the cost of one navigation on a control that is
 * used a few times a day at most.
 *
 * The choice persists in localStorage, not the URL: it is infrastructure, not
 * view state, and a shared link should open on the recipient's own source.
 */
import { useSyncExternalStore } from 'react';

export type DataSource = 'DEMO' | 'LIVE';

const STORAGE_KEY = 'resource-ui.data-source';

export const DATA_SOURCE_LABEL = {
  DEMO: 'Demo data',
  LIVE: 'Live server',
} satisfies Record<DataSource, string>;

/** The persisted choice; anything unrecognised reads as the demo default. */
export const readDataSource = (): DataSource => {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'LIVE' ? 'LIVE' : 'DEMO';
  } catch {
    // Storage can be unavailable (private modes); the demo always works.
    return 'DEMO';
  }
};

/** Persists the choice and reloads, so the new source starts on a clean client. */
export const switchDataSource = (source: DataSource): void => {
  try {
    window.localStorage.setItem(STORAGE_KEY, source);
  } catch {
    // Without storage the reload falls back to the demo default - still honest.
  }
  window.location.reload();
};

/**
 * The last failure the live link reported, for the banner.
 *
 * A module-level store rather than React state: the Apollo link that reports
 * failures is constructed before React renders, and every subscriber (the one
 * banner) should see the same value.
 */
let liveFailure: string | null = null;
const listeners = new Set<() => void>();

export const reportLiveFailure = (message: string): void => {
  if (liveFailure === message) {
    return;
  }
  liveFailure = message;
  for (const listener of listeners) {
    listener();
  }
};

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** The live link's last failure, or null while everything answers. */
export const useLiveFailure = (): string | null => useSyncExternalStore(subscribe, () => liveFailure);
