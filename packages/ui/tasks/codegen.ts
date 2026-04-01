import { join } from 'node:path';

import type { CodegenConfig } from '@graphql-codegen/cli';
import type { ClientPresetConfig } from '@graphql-codegen/client-preset';

// Simple mapping of scalar types to their TypeScript representation
// Some of these might be wrong or incomplete, feel free to adjust as needed
/*eslint sort-keys: "error"*/
const scalars = {
  AtomId: 'string',
  AttachmentId: 'string',
  BigDecimal: 'string|number',
  CallForProposalsId: 'string',
  ChronicleId: 'string',
  ConfigurationRequestId: 'string',
  DatasetFilename: 'string',
  DatasetId: 'string',
  DatasetReferenceLabel: 'string',
  Date: 'string',
  DateTime: 'string | Date',
  DmsString: 'string',
  EmailAddress: 'string',
  EpochString: 'string',
  ExecutionEventId: 'string',
  Extinction: 'number',
  GroupId: 'string',
  HmsString: 'string',
  IntPercent: 'number',
  Long: 'number',
  NonEmptyString: 'string',
  NonNegBigDecimal: 'number',
  NonNegInt: 'number',
  NonNegLong: 'number',
  NonNegShort: 'number',
  ObsAttachmentId: 'string',
  ObservationId: 'string',
  ObservationReferenceLabel: 'string',
  PosBigDecimal: 'number',
  PosInt: 'number',
  PosLong: 'number',
  PosShort: 'number',
  ProgramId: 'string',
  ProgramReferenceLabel: 'string',
  ProgramUserId: 'string',
  ProposalReferenceLabel: 'string',
  Semester: "`${number}${number}${number}${number}${'A' | 'B'}`",
  SignalToNoise: 'number',
  StepId: 'string',
  TargetId: 'string',
  Timestamp: 'string',
  TransactionId: 'string',
  UserId: 'string',
  UserInvitationId: 'string',
  UserInvitationKey: 'string',
  VisitId: 'string',
} satisfies Record<string, string>;
/*eslint-disable sort-keys*/

const sharedConfig = {
  scalars,
  // Generate union types (`'foo' | 'bar'`) for enums instead of non-standard typescript enums
  enumsAsTypes: true,
  useTypeImports: true,
  defaultScalarType: 'unknown',
  avoidOptionals: {
    field: true,
    inputValue: false,
  },
  skipTypeNameForRoot: true,
  // Required for fragments to work in tests
  nonOptionalTypename: true,
};

const presetConfig = {
  fragmentMasking: false,
} satisfies ClientPresetConfig;

export default {
  ignoreNoDocuments: true,
  generates: {
    './src/gql/odb/gen/': {
      schema: require.resolve('@gemini-hlsw/lucuma-schemas/odb'),
      documents: './src/gql/odb/*.{ts,tsx}',
      config: sharedConfig,
      preset: 'client',
      presetConfig,
    },
    './src/gql/server/gen/': {
      schema: require.resolve('@gemini-hlsw/lucuma-schemas/navigate'),
      documents: './src/gql/server/*.{ts,tsx}',
      config: sharedConfig,
      preset: 'client',
      presetConfig,
    },
    './src/gql/configs/gen/': {
      schema: join('..', 'configs', 'src/**/*.graphql'),
      documents: './src/gql/configs/*.{ts,tsx}',
      config: sharedConfig,
      preset: 'client',
      presetConfig,
    },
  },
} satisfies CodegenConfig;
