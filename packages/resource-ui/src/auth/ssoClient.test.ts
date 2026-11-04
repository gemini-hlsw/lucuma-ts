import { describe, expect, it } from 'vitest';

import { CURRENT_ENV } from '@/app/environment';

import { signInUrl } from './ssoClient';

describe(signInUrl, () => {
  it('sends SSO back to where the reader was, as an absolute URL', () => {
    const url = new URL(signInUrl('/night?site=GN'));

    expect(url.origin).toBe(new URL(CURRENT_ENV.ssoUri).origin);
    expect(url.pathname).toBe('/auth/v1/stage1');
    expect(url.searchParams.get('state')).toBe(`${window.location.origin}/night?site=GN`);
  });

  it('falls back to the app root rather than returning to another origin', () => {
    const url = new URL(signInUrl('https://phish.example/steal'));

    expect(url.searchParams.get('state')).toBe(`${window.location.origin}/`);
  });
});
