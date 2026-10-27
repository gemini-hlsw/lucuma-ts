import { resolveEnvironment, type SsoEnvironment, ssoEnvironment } from '@gemini-hlsw/lucuma-common-ui';

export interface Environment extends SsoEnvironment {
  readonly graphqlEndpoint: string;
}

const ENVIRONMENTS = {
  'resource-dev.gemini.edu': {
    ...ssoEnvironment('development'),
    graphqlEndpoint: 'https://resource-api-dev.gemini.edu/resource/graphql',
  },
  'resource-test.gemini.edu': {
    ...ssoEnvironment('staging'),
    graphqlEndpoint: 'https://resource-api-test.gemini.edu/resource/graphql',
  },
  'resource.gemini.edu': {
    ...ssoEnvironment('production'),
    graphqlEndpoint: 'https://resource-api.gemini.edu/resource/graphql',
  },
  localhost: {
    ...ssoEnvironment('development'),
    graphqlEndpoint: '/resource/graphql',
  },
} satisfies Record<string, Environment>;

export const environmentFor = (hostname: string): Environment =>
  resolveEnvironment(ENVIRONMENTS, hostname, 'localhost');

export const CURRENT_ENV = environmentFor(window.location.hostname);

export const liveGraphqlEndpoint = CURRENT_ENV.graphqlEndpoint;

const PRODUCTION_HOSTS: readonly string[] = [];

export const environmentLabel = (hostname: string): string | null => {
  if (PRODUCTION_HOSTS.includes(hostname)) return null;
  const { name } = environmentFor(hostname);
  return name.charAt(0).toUpperCase() + name.slice(1);
};
