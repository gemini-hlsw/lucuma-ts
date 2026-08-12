/**
 * GraphQL Codegen config for typed client operations.
 *
 * Types are generated from the local v1 schema preview (./mock-server/schema.graphql),
 * which mirrors lucuma-odb/resource/docs/v1-graphql-api.md. When the Scala backend
 * ships, switch the schema back to the published package
 * (@gemini-hlsw/lucuma-schemas/resource).
 */

import type { CodegenConfig } from '@graphql-codegen/cli';
import type { ClientPresetConfig } from '@graphql-codegen/client-preset';

// Dates and timestamps arrive as ISO strings; parsing them into domain values is
// the adapters' job (src/domain/adapters.ts), not codegen's. The rest mirror the
// ODB scalars the real schema imports (v1-graphql-api.md §2).
const scalars = {
  Date: 'string',
  Timestamp: 'string',
  Semester: 'string',
  NonEmptyString: 'string',
  ProgramReferenceLabel: 'string',
  PosInt: 'number',
  Long: 'number',
  BigDecimal: 'number',
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
  schema: './mock-server/schema.graphql',
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
