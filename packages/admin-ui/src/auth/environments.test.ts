import { describe, expect, it } from 'vitest';

import { environmentFor } from './environments';

describe(environmentFor.name, () => {
  it('resolves each deployed admin host to its own services', () => {
    const dev = environmentFor('admin-dev.lucuma.xyz');
    expect(dev.name).toBe('development');
    expect(dev.ssoUri).toBe('https://sso-dev.gpp.lucuma.xyz');
    expect(dev.odbUri).toBe('https://lucuma-postgres-odb-dev.herokuapp.com/odb');

    const staging = environmentFor('admin-staging.lucuma.xyz');
    expect(staging.name).toBe('staging');
    expect(staging.ssoUri).toBe('https://sso-test.gpp.gemini.edu');
    expect(staging.odbUri).toBe('https://lucuma-postgres-odb-staging.herokuapp.com/odb');

    const production = environmentFor('admin.gemini.edu');
    expect(production.name).toBe('production');
    expect(production.ssoUri).toBe('https://sso.gpp.gemini.edu');
    expect(production.odbUri).toBe('https://lucuma-postgres-odb-production.herokuapp.com/odb');
    expect(production.ssoGraphqlUri).toBe('https://sso.gpp.gemini.edu/graphql');
  });

  it('falls through to the proxied local-dev entry for unknown hosts', () => {
    for (const host of ['localhost', 'some-preview.example.org']) {
      const env = environmentFor(host);
      expect(env.name).toBe('development');
      // Relative URIs — served by the Vite dev proxies, same-origin.
      expect(env.odbUri).toBe('/odb');
      expect(env.ssoGraphqlUri).toBe('/sso-graphql');
    }
  });
});
