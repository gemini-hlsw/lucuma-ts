/**
 * GraphQL Codegen config for generating typed client queries
 * from the live Resource GraphQL service.
 */

import type { CodegenConfig } from '@graphql-codegen/cli';
import type { ClientPresetConfig } from '@graphql-codegen/client-preset';

const scalars = {
  BigDecimal: 'string | number',
  Date: 'string',
  Timestamp: 'string',
} satisfies Record<string, string>;

const sharedConfig = {
  useTypeImports: true,
  enumsAsTypes: true,
  skipTypeNameForRoot: true,
  // Required for fragments to work in tests
  nonOptionalTypename: true,
  scalars,
};

const presetConfig = {
  fragmentMasking: false,
} satisfies ClientPresetConfig;

const config: CodegenConfig = {
  overwrite: true,
  schema: import.meta.resolve('@gemini-hlsw/lucuma-schemas/resource'),
  ignoreNoDocuments: true,
  documents: ['src/gql/**/*.ts', 'src/**/*.tsx'],
  generates: {
    'src/gql/gen/': {
      preset: 'client',
      config: sharedConfig,
      presetConfig,
    },
  },
};

export default config;
