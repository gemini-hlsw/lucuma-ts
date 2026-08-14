/**
 * GraphQL Codegen config for the Admin UI's two endpoints, per-endpoint gen
 * dirs in the navigate-ui style. Both schemas come from the published
 * @gemini-hlsw/lucuma-odb-schemas package:
 *
 *   - ODB (src/gql, gen in src/gql/odb/gen) — the /odb export.
 *   - SSO (src/gql/sso, gen in src/gql/sso/gen) — the /sso export.
 */

import type { CodegenConfig } from '@graphql-codegen/cli';
import type { ClientPresetConfig } from '@graphql-codegen/client-preset';

const odbScalars = {
  BigDecimal: 'string | number',
  Date: 'string',
  Timestamp: 'string',
  NonEmptyString: 'string',
  NonNegInt: 'number',
  Semester: 'string',
  CallForProposalsId: 'string',
  ProgramId: 'string',
  ObservationId: 'string',
  GroupId: 'string',
  ConfigurationRequestId: 'string',
  UserId: 'string',
  ProgramUserId: 'string',
  ProgramNoteId: 'string',
  IntPercent: 'number',
  ProgramReferenceLabel: 'string',
  ProposalReferenceLabel: 'string',
  ObservationReferenceLabel: 'string',
  HmsString: 'string',
  DmsString: 'string',
  TargetId: 'string',
} satisfies Record<string, string>;

const ssoScalars = {
  UserId: 'string',
  OrcidId: 'string',
  RoleId: 'string',
  ApiKeyId: 'string',
  NonNegInt: 'number',
} satisfies Record<string, string>;

const sharedConfig = {
  useTypeImports: true,
  enumsAsTypes: true,
  skipTypeNameForRoot: true,
  // Required for fragments to work in tests
  nonOptionalTypename: true,
};

const presetConfig = {
  fragmentMasking: false,
} satisfies ClientPresetConfig;

const config: CodegenConfig = {
  overwrite: true,
  generates: {
    'src/gql/odb/gen/': {
      schema: import.meta.resolve('@gemini-hlsw/lucuma-odb-schemas/odb'),
      documents: ['src/gql/*.ts', 'src/**/*.tsx'],
      preset: 'client',
      config: { ...sharedConfig, scalars: odbScalars },
      presetConfig,
    },
    'src/gql/sso/gen/': {
      schema: import.meta.resolve('@gemini-hlsw/lucuma-odb-schemas/sso'),
      documents: ['src/gql/sso/*.ts'],
      preset: 'client',
      config: { ...sharedConfig, scalars: ssoScalars },
      presetConfig,
    },
  },
};

export default config;
