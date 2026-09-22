export interface Environment {
  readonly name: 'development' | 'staging';
  readonly graphqlEndpoint: string;
  readonly versionSuffix: 'DEV' | 'STAGING';
}

const ENVIRONMENTS = {
  'resource-dev.lucuma.xyz': {
    name: 'development',
    graphqlEndpoint: 'https://lucuma-resource-dev.lucuma.xyz/resource/graphql',
    versionSuffix: 'DEV',
  },
  'resource-staging.lucuma.xyz': {
    name: 'staging',
    graphqlEndpoint: 'https://lucuma-resource-staging.lucuma.xyz/resource/graphql',
    versionSuffix: 'STAGING',
  },
  localhost: { name: 'development', graphqlEndpoint: '/resource/graphql', versionSuffix: 'DEV' },
} satisfies Record<string, Environment>;

export const environmentFor = (hostname: string): Environment =>
  ENVIRONMENTS[hostname as keyof typeof ENVIRONMENTS] ?? ENVIRONMENTS.localhost;

export const CURRENT_ENV = environmentFor(window.location.hostname);

export const liveGraphqlEndpoint = CURRENT_ENV.graphqlEndpoint;

const PRODUCTION_HOSTS: readonly string[] = [];

export const environmentLabel = (hostname: string): string | null => {
  if (PRODUCTION_HOSTS.includes(hostname)) return null;
  const { name } = environmentFor(hostname);
  return name.charAt(0).toUpperCase() + name.slice(1);
};
