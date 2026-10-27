import { resolveEnvironment, ssoEnvironment, VERSION_SUFFIX } from './environments.ts';

const LOCAL = { name: 'development', endpoint: '/proxied' };
const TABLE = {
  'app-dev.gemini.edu': { name: 'development', endpoint: 'https://dev.example.test' },
  'app.gemini.edu': { name: 'production', endpoint: 'https://prod.example.test' },
  localhost: LOCAL,
};

describe(resolveEnvironment, () => {
  it('returns the entry listed for a known hostname', () => {
    expect(resolveEnvironment(TABLE, 'app.gemini.edu', 'localhost')).toEqual({
      name: 'production',
      endpoint: 'https://prod.example.test',
    });
  });

  it.each(['localhost', 'some-preview.example.org', ''])('falls through to the fallback entry for %j', (hostname) => {
    expect(resolveEnvironment(TABLE, hostname, 'localhost')).toBe(LOCAL);
  });

  it.each(['constructor', 'toString', '__proto__', 'hasOwnProperty'])(
    'never resolves the object prototype key %s as an environment',
    (hostname) => {
      expect(resolveEnvironment(TABLE, hostname, 'localhost')).toBe(LOCAL);
    },
  );
});

describe(ssoEnvironment, () => {
  it('pairs each environment with its own SSO service', () => {
    expect(ssoEnvironment('development')).toEqual({ name: 'development', ssoUri: 'https://sso-dev.gpp.gemini.edu' });
    expect(ssoEnvironment('staging')).toEqual({ name: 'staging', ssoUri: 'https://sso-test.gpp.gemini.edu' });
    expect(ssoEnvironment('production')).toEqual({ name: 'production', ssoUri: 'https://sso.gpp.gemini.edu' });
  });
});

describe('VERSION_SUFFIX', () => {
  it('uses the Explore build-suffix spelling for every environment', () => {
    expect(VERSION_SUFFIX).toEqual({ development: 'DEV', staging: 'STAGING', production: 'PROD' });
  });
});
