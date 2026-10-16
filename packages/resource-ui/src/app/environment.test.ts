import { describe, expect, it } from 'vitest';

import { environmentFor, environmentLabel } from './environment';

describe(environmentFor, () => {
  it('reads the dev deployment off its own hostname', () => {
    expect(environmentFor('resource-dev.gemini.edu')).toEqual({
      name: 'development',
      graphqlEndpoint: 'https://resource-api-dev.gemini.edu/resource/graphql',
      ssoUri: 'https://sso-dev.gpp.gemini.edu',
      versionSuffix: 'DEV',
    });
  });

  it('reads the staging deployment off its own hostname', () => {
    expect(environmentFor('resource-test.gemini.edu')).toEqual({
      name: 'staging',
      graphqlEndpoint: 'https://resource-api-test.gemini.edu/resource/graphql',
      ssoUri: 'https://sso-test.gpp.gemini.edu',
      versionSuffix: 'STAGING',
    });
  });

  it.each(['localhost', 'some-preview.example.org'])(
    'serves %s through the dev proxy, on the relative endpoint',
    (hostname) => {
      expect(environmentFor(hostname)).toEqual({
        name: 'development',
        graphqlEndpoint: '/resource/graphql',
        ssoUri: 'https://sso-dev.gpp.gemini.edu',
        versionSuffix: 'DEV',
      });
    },
  );
});

describe(environmentLabel, () => {
  it('names every host it does not know as a development build', () => {
    // Fail loud: an unrecognised serving is not production until it is listed as one.
    expect(environmentLabel('localhost')).toBe('Development');
    expect(environmentLabel('resource-dev.gemini.edu')).toBe('Development');
  });

  it('names the staging serving as its own environment', () => {
    expect(environmentLabel('resource-test.gemini.edu')).toBe('Staging');
  });
});
