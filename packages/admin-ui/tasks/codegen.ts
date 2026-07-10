/**
 * GraphQL Codegen config for the Admin UI's ODB operations.
 *
 * The Users view's SSO operations (roster + addRole) are NOT generated here:
 * the SSO schema isn't published in @gemini-hlsw/lucuma-schemas, and its
 * `users` query only exists on lucuma-sso's add-users-query branch. Generate
 * SSO types once that schema ships.
 */

import type { CodegenConfig } from '@graphql-codegen/cli';
import type { ClientPresetConfig } from '@graphql-codegen/client-preset';

const scalars = {
  BigDecimal: 'string | number',
  Date: 'string',
  Timestamp: 'string',
  NonEmptyString: 'string',
  NonNegInt: 'number',
  Semester: 'string',
  CallForProposalsId: 'string',
  ProgramId: 'string',
  ObservationId: 'string',
  ConfigurationRequestId: 'string',
  UserId: 'string',
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
  schema: import.meta.resolve('@gemini-hlsw/lucuma-schemas/odb'),
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
