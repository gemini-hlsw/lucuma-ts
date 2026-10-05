import type { CodegenConfig } from '@graphql-codegen/cli';
import type { ClientPresetConfig } from '@graphql-codegen/client-preset';

// ISO strings; parsing them into domain values is the adapters' job, not codegen's.
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

/** `sort` is missing from `CodegenConfig`, hence the intersection. Alphabetising `TooSupport` breaks a scale. */
const config: CodegenConfig & { sort: boolean } = {
  overwrite: true,
  schema: import.meta.resolve('@gemini-hlsw/lucuma-odb-schemas/resource'),
  ignoreNoDocuments: true,
  documents: ['src/gql/**/*.ts', 'src/**/*.tsx'],
  sort: false,
  generates: {
    'src/gql/gen/': {
      preset: 'client',
      config: sharedConfig,
      presetConfig,
    },
    // The package schema with its `#import`s expanded, for the tests that build it in the browser.
    'src/gql/gen/schema.graphql': {
      plugins: ['./tasks/printSchemaPlugin.ts'],
    },
  },
};

export default config;
