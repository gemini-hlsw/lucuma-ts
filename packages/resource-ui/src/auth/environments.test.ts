import { describe, expect, it } from 'vitest';

import { environmentFor } from './environments';

describe(environmentFor, () => {
  it('resolves each deployed host to its own SSO', () => {
    const dev = environmentFor('resource-dev.lucuma.xyz');
    expect(dev.name).toBe('development');
    expect(dev.ssoUri).toBe('https://sso-dev.gpp.lucuma.xyz');

    const staging = environmentFor('resource-staging.lucuma.xyz');
    expect(staging.name).toBe('staging');
    expect(staging.ssoUri).toBe('https://sso-test.gpp.gemini.edu');
  });

  it('falls through to development for localhost and unknown hosts', () => {
    for (const host of ['localhost', 'some-preview.example.org']) {
      const env = environmentFor(host);
      expect(env.name).toBe('development');
      expect(env.ssoUri).toBe('https://sso-dev.gpp.lucuma.xyz');
    }
  });

  it('gives every environment an absolute SSO origin, since cookie flows cannot be proxied', () => {
    for (const host of ['resource-dev.lucuma.xyz', 'resource-staging.lucuma.xyz', 'localhost']) {
      expect(environmentFor(host).ssoUri).toMatch(/^https:\/\//);
    }
  });
});
