import { describe, expect, it } from 'vitest';

import { CURRENT_ENV } from './environments';
import { signInUrl } from './ssoClient';

describe(signInUrl, () => {
  it('signs in through the environment SSO and returns to the current page by default', () => {
    const url = new URL(signInUrl());

    expect(url.origin).toBe(new URL(CURRENT_ENV.ssoUri).origin);
    expect(url.pathname).toBe('/auth/v1/stage1');
    expect(url.searchParams.get('state')).toBe(window.location.href);
  });

  it('falls back to the app root rather than returning to another origin', () => {
    const url = new URL(signInUrl('https://phish.example/steal'));

    expect(url.searchParams.get('state')).toBe(`${window.location.origin}/`);
  });
});
