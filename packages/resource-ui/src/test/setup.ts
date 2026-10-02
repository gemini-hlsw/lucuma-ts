import { afterEach, beforeEach } from 'vitest';

import { odbTokenAtom, sessionCheckedAtom, signedOutElsewhereAtom } from '@/components/atoms/auth';
import { store } from '@/components/atoms/store';

import { recordUnansweredQueries, takeUnansweredQueries } from './unansweredQueries';

recordUnansweredQueries();

/**
 * Preferences outlive a component but must not outlive a test: each one starts with no habit.
 * The event is what tells a preference its session choice is stale - the same path another tab takes.
 */
beforeEach(() => {
  localStorage.clear();
  window.dispatchEvent(new StorageEvent('storage', { key: null }));
  store.set(odbTokenAtom, null);
  store.set(sessionCheckedAtom, false);
  store.set(signedOutElsewhereAtom, false);
});

afterEach(() => {
  const unanswered = takeUnansweredQueries();
  if (unanswered.length > 0) throw new Error(`A query had no mocked response:\n${unanswered.join('\n\n')}`);
});
