import { ApolloClient, HttpLink, InMemoryCache } from '@apollo/client';
import { withAbsoluteUri } from '@gemini-hlsw/lucuma-common-ui';

const graphqlEndpoints = {
  'resource-ae0b7-dev.web.app': 'https://lucuma-resource-dev.lucuma.xyz/resource/graphql',
  'resource-dev.lucuma.xyz': 'https://lucuma-resource-dev.lucuma.xyz/resource/graphql',
  localhost: '/resource/graphql',

  'resource-ae0b7-staging.web.app': 'https://lucuma-resource-staging.lucuma.xyz/resource/graphql',
  'resource-staging.lucuma.xyz': 'https://lucuma-resource-staging.lucuma.xyz/resource/graphql',

  'resource-ae0b7.web.app': 'https://lucuma-resource-dev.lucuma.xyz/resource/graphql',
  'resource.gemini.edu': 'https://lucuma-resource-dev.lucuma.xyz/resource/graphql',
} satisfies Record<string, string>;

const defaultGraphqlEndpoint = graphqlEndpoints.localhost;

const uri = graphqlEndpoints[window.location.hostname as keyof typeof graphqlEndpoints] ?? defaultGraphqlEndpoint;

// Create an Apollo Client instance with the specified GraphQL endpoint and cache configuration.
export const client = new ApolloClient({
  clientAwareness: {
    name: 'resource-ui',
    version: import.meta.env.FRONTEND_VERSION,
  },
  link: new HttpLink({ uri: withAbsoluteUri(uri) }),
  cache: new InMemoryCache(),
});
