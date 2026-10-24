import { useAtomCallback } from 'jotai/utils';

import { odbTokenAtom, signingOutAtom } from '@/components/atoms/auth';

import * as sso from './ssoClient';

/**
 * Signs out: the app drops its token at once, then SSO is asked to clear the session cookie. `signingOutAtom`
 * is set first and held until SSO has answered, so the silent sign-in in AuthSession cannot use the cookie
 * that is still in the browser to sign the user straight back in (sc-10853). The atom is also the guard: a
 * second click while a sign-out is pending is ignored, from any button. `onFailure` hears about a logout SSO
 * could not complete: the cookie is then still valid, so the silent sign-in resumes and signs the user in
 * again. A logout that never settles leaves the user signed out until the page is reloaded.
 */
export function useSignOut(onFailure?: (error: Error) => void): () => Promise<void> {
  return useAtomCallback(async (get, set) => {
    if (get(signingOutAtom)) return;
    set(signingOutAtom, true);
    set(odbTokenAtom, null);
    try {
      await sso.logout();
    } catch (err) {
      onFailure?.(err instanceof Error ? err : new Error(String(err)));
    } finally {
      set(signingOutAtom, false);
    }
  });
}
