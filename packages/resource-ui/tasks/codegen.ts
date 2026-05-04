/**
 * GraphQL Codegen config for generating typed client queries.
 */

import type { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  overwrite: true,
  schema: './mock-server/*.graphql',
  documents: ['src/gql/**/*.ts', 'src/**/*.tsx'],
  generates: {
    'src/gql/gen/': {
      preset: 'client',
      config: {
        useTypeImports: true,
        enumsAsTypes: true,
        skipTypeNameForRoot: true,
        // Required for fragments to work in tests
        nonOptionalTypename: true,
      },
      presetConfig: {
        fragmentMasking: false,
      },
    },
  },
};

export default config;
