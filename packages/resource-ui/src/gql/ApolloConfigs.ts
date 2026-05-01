import { ApolloClient, HttpLink, InMemoryCache } from '@apollo/client';

// Create an Apollo Client instance with the specified GraphQL endpoint and cache configuration.
export const client = new ApolloClient({
  link: new HttpLink({
    uri: '/graphql',
  }),
  cache: new InMemoryCache(),
});
