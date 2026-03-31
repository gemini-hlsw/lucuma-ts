import {
  parseAttachmentId,
  parseCallForProposalsId,
  parseDatasetId,
  parseExecutionEventId,
  parseGroupId,
  parseObservationId,
  parseProgramId,
  parseProgramNoteId,
  parseProgramUserId,
  parseStandardRoleId,
  parseTargetId,
  parseUserId,
  parseVisitId,
} from '@gemini-hlsw/lucuma-core';
import { GraphQLScalarType, Kind } from 'graphql';
import { PositiveIntResolver } from 'graphql-scalars';

PositiveIntResolver.name = 'PosInt';
export const PosIntResolver = PositiveIntResolver;

export const AttachmentIdResolver = newObdIdGraphQLScalarType('AttachmentId', 'a', parseAttachmentId);
export const CallForProposalsIdResolver = newObdIdGraphQLScalarType('CallForProposalsId', 'c', parseCallForProposalsId);
export const DatasetIdResolver = newObdIdGraphQLScalarType('DatasetId', 'd', parseDatasetId);
export const ExecutionEventIdResolver = newObdIdGraphQLScalarType('ExecutionEventId', 'e', parseExecutionEventId);
export const GroupIdResolver = newObdIdGraphQLScalarType('GroupId', 'g', parseGroupId);
export const ObservationIdResolver = newObdIdGraphQLScalarType('ObservationId', 'o', parseObservationId);
export const ProgramIdResolver = newObdIdGraphQLScalarType('ProgramId', 'p', parseProgramId);
export const ProgramNoteIdResolver = newObdIdGraphQLScalarType('ProgramNoteId', 'n', parseProgramNoteId);
export const ProgramUserIdResolver = newObdIdGraphQLScalarType('ProgramUserId', 'm', parseProgramUserId);
export const StandardRoleIdResolver = newObdIdGraphQLScalarType('StandardRoleId', 'r', parseStandardRoleId);
export const TargetIdResolver = newObdIdGraphQLScalarType('TargetId', 't', parseTargetId);
export const UserIdResolver = newObdIdGraphQLScalarType('UserId', 'u', parseUserId);
export const VisitIdResolver = newObdIdGraphQLScalarType('VisitId', 'v', parseVisitId);

/**
 * Creates a new GraphQL scalar type for odb IDs.
 */
function newObdIdGraphQLScalarType(name: string, idTag: string, parser: (value: string) => string | undefined) {
  return new GraphQLScalarType<unknown, string>({
    name,
    serialize(value) {
      const parsed =
        typeof value === 'string' ? parser(value) : typeof value === 'number' ? parser(`${idTag}-${value}`) : undefined;
      if (!parsed) {
        throw new Error(`'${String(value)}' is not a valid ${name}`);
      }

      return parsed;
    },
    parseValue(value) {
      return this.serialize?.(value);
    },
    parseLiteral(ast) {
      if (ast.kind === Kind.STRING) {
        return this.serialize?.(ast.value);
      } else if (ast.kind === Kind.INT) {
        return this.serialize?.(`${idTag}-${ast.value}`);
      }

      throw new Error(`'${ast.kind}' is not a valid kind for ${name}`);
    },
  });
}

export const BigDecimalResolver = new GraphQLScalarType<unknown, number>({
  name: 'BigDecimal',
  serialize(value) {
    if (typeof value === 'string') {
      return parseFloat(value);
    } else if (typeof value === 'number') {
      return value;
    }
    throw new Error(`Value is not a valid BigDecimal: ${String(value)}`);
  },
  parseValue(value) {
    if (typeof value === 'string') {
      return parseFloat(value);
    } else if (typeof value === 'number') {
      return value;
    }
    throw new Error(`Value is not a valid BigDecimal: ${String(value)}`);
  },
  parseLiteral(ast) {
    if (ast.kind === Kind.STRING || ast.kind === Kind.INT || ast.kind === Kind.FLOAT) {
      return parseFloat(ast.value);
    }
    throw new Error(`Value is not a valid BigDecimal: ${ast.kind}`);
  },
});
