import { defineConfig } from '@eddeee888/gcg-typescript-resolver-files';
import type { CodegenConfig } from '@graphql-codegen/cli';

export default {
  overwrite: true,
  schema: './src/graphql/schema/*.graphql',
  generates: {
    'src/graphql/gen': defineConfig({
      typesPluginsConfig: {
        contextType: '../../server.ts#GraphQLContext',
        enumsAsTypes: true,
        immutableTypes: true,
        strictScalars: true,
        inputMaybeValue: 'T | undefined',
        skipTypename: true,
        useTypeImports: true,
      },
      importExtension: '.ts',
      resolverGeneration: 'minimal',
      resolverRelativeTargetDir: '../resolvers',
      emitLegacyCommonJSImports: false,
      scalarsOverrides: {
        PosInt: { resolver: '../resolvers/Scalars.ts.ts#PosIntResolver', type: 'number' },
        BigDecimal: { type: 'string|number', resolver: '../resolvers/Scalars.ts.ts#BigDecimalResolver' },
        AttachmentId: { type: 'string', resolver: '../resolvers/Scalars.ts.ts#AttachmentIdResolver' },
        CallForProposalsId: { type: 'string', resolver: '../resolvers/Scalars.ts.ts#CallForProposalsIdResolver' },
        DatasetId: { type: 'string', resolver: '../resolvers/Scalars.ts.ts#DatasetIdResolver' },
        ExecutionEventId: { type: 'string', resolver: '../resolvers/Scalars.ts.ts#ExecutionEventIdResolver' },
        GroupId: { type: 'string', resolver: '../resolvers/Scalars.ts.ts#GroupIdResolver' },
        ObservationId: { type: 'string', resolver: '../resolvers/Scalars.ts.ts#ObservationIdResolver' },
        ProgramId: { type: 'string', resolver: '../resolvers/Scalars.ts.ts#ProgramIdResolver' },
        ProgramNoteId: { type: 'string', resolver: '../resolvers/Scalars.ts.ts#ProgramNoteIdResolver' },
        ProgramUserId: { type: 'string', resolver: '../resolvers/Scalars.ts.ts#ProgramUserIdResolver' },
        StandardRoleId: { type: 'string', resolver: '../resolvers/Scalars.ts.ts#StandardRoleIdResolver' },
        TargetId: { type: 'string', resolver: '../resolvers/Scalars.ts.ts#TargetIdResolver' },
        UserId: { type: 'string', resolver: '../resolvers/Scalars.ts.ts#UserIdResolver' },
        VisitId: { type: 'string', resolver: '../resolvers/Scalars.ts.ts#VisitIdResolver' },
        DmsString: { type: 'string', resolver: '../resolvers/Scalars.ts.ts#DmsStringResolver' },
        HmsString: { type: 'string', resolver: '../resolvers/Scalars.ts.ts#HmsStringResolver' },
        EpochString: { type: 'string', resolver: '../resolvers/Scalars.ts.ts#EpochStringResolver' },
      },
    }),
  },
} satisfies CodegenConfig;
