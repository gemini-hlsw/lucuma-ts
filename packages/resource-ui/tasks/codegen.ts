/**
 * GraphQL Codegen config for generating typed client queries
 * from the live Resource GraphQL service.
 */

import type { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  overwrite: true,
  schema: import.meta.resolve('@gemini-hlsw/lucuma-schemas/resource'),
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
