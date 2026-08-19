/**
 * GraphQL Codegen config for typed client operations, and for the SDL the mock
 * serves.
 *
 * Types are generated from the local v1 schema preview (./mock-server/schema.graphql),
 * which mirrors lucuma-odb/resource/docs/v1-graphql-api.md. When the Scala backend
 * ships, switch the schema back to the published package
 * (@gemini-hlsw/lucuma-schemas/resource).
 *
 * Codegen resolves that file's `#import` of the ODB types through its own
 * loader, so it is also the one place that already holds the expanded schema.
 * `src/gql/gen/schema.graphql` is that expansion written back out, the way
 * `packages/configs` emits its `typeDefs.generated.ts`, and it is what the mock
 * server and the tests read - no consumer resolves imports at runtime, and this
 * package needs no @graphql-tools dependency of its own. It sits beside the
 * typed operations because every package in this workspace keeps its generated
 * code in a `gen/` directory under `src/`, and this one is generated code.
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

/**
 * `sort` is forwarded to @graphql-tools/load but is missing from `CodegenConfig`'s
 * type, hence the intersection. Codegen sorts the loaded schema alphabetically by
 * default, and not only the types: fields go too (`ScheduleBlock` prints
 * `interval, note, site`) and so do enum values, which is where it does real
 * damage - `TooSupport` is a scale, `STANDARD, INTERRUPT, RAPID, NONE`, and the
 * alphabet shuffles it into nonsense. This schema is a reviewed design document
 * and the SDL below is what GraphiQL shows a reader, so the alphabet is turned
 * off and the authored order kept.
 *
 * That order is close to the source file's rather than exactly it: resolving the
 * `#import` interleaves each ODB type where the expansion first needs it -
 * `Timestamp` between `TimestampIntervalInput` and `DateInterval`, `Site` after
 * the last `ScheduleBlock` implementor - and gathers the implementors under the
 * interface, which moves `Instrument` past them. Related types still read
 * together, which is the point; alphabetising scatters them.
 */
const config: CodegenConfig & { sort: boolean } = {
  overwrite: true,
  schema: './mock-server/schema.graphql',
  ignoreNoDocuments: true,
  documents: ['src/gql/**/*.ts', 'src/**/*.tsx'],
  sort: false,
  generates: {
    'src/gql/gen/': {
      preset: 'client',
      config: sharedConfig,
      presetConfig,
    },
    // The one schema all four consumers read: the mock server, its resolver
    // tests, the cache test and the browser-test Apollo client.
    'src/gql/gen/schema.graphql': {
      plugins: ['./tasks/printSchemaPlugin.ts'],
    },
  },
};

export default config;
