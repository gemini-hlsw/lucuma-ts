import {
  parseAttachmentId,
  parseCallForProposalsId,
  parseDatasetId,
  parseDmsString,
  parseEpochString,
  parseExecutionEventId,
  parseGroupId,
  parseHmsString,
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

export const PosIntResolver = new GraphQLScalarType({
  // eslint-disable-next-line @typescript-eslint/no-misused-spread
  ...PositiveIntResolver,
  name: 'PosInt',
});

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
  const parseOrThrow = (value: unknown) => {
    const parsed =
      typeof value === 'string' ? parser(value) : typeof value === 'number' ? parser(`${idTag}-${value}`) : undefined;
    if (!parsed) {
      throw new TypeError(`'${String(value)}' is not a valid ${name}`);
    }
    return parsed;
  };
  return new GraphQLScalarType<unknown, string>({
    name,
    description: `A ${name} is a string that starts with '${idTag}-' followed by a unique identifier.`,
    coerceOutputValue(value) {
      return parseOrThrow(value);
    },
    coerceInputValue(value) {
      return parseOrThrow(value);
    },
    coerceInputLiteral(ast) {
      if (ast.kind === Kind.STRING) {
        return parseOrThrow(ast.value);
      } else if (ast.kind === Kind.FLOAT || ast.kind === Kind.INT) {
        return parseOrThrow(`${idTag}-${ast.value}`);
      }

      throw new TypeError(`'${ast.kind}' is not a valid kind for ${name}`);
    },
  });
}

const parseBigDecimalOrThrow = (value: unknown) => {
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    if (!isNaN(parsed)) return parsed;
  } else if (typeof value === 'number') {
    return value;
  } else if (typeof value === 'bigint') {
    return Number(value);
  }
  throw new TypeError(`'${String(value)}' is not a valid BigDecimal`);
};
export const BigDecimalResolver = new GraphQLScalarType<unknown, number>({
  name: 'BigDecimal',
  description: 'A BigDecimal is a number that can be represented as a string or a number.',
  coerceOutputValue(value) {
    return parseBigDecimalOrThrow(value);
  },
  coerceInputValue(value) {
    return parseBigDecimalOrThrow(value);
  },
  coerceInputLiteral(ast) {
    if (ast.kind === Kind.STRING || ast.kind === Kind.INT || ast.kind === Kind.FLOAT) {
      return parseBigDecimalOrThrow(ast.value);
    }
    throw new TypeError(`Value is not a valid BigDecimal: ${ast.kind}`);
  },
});

const graphQlParserResolver = (name: string, parser: (maybe: string) => string | undefined) => {
  const parseOrThrow = (value: unknown) => {
    if (typeof value === 'string') {
      const parsed = parser(value);
      if (parsed !== undefined) return parsed;
    }
    throw new TypeError(`'${String(value)}' is not a valid ${name}`);
  };
  return new GraphQLScalarType<string, string>({
    name,
    coerceInputValue(value) {
      return parseOrThrow(value);
    },
    coerceInputLiteral(ast) {
      if (ast.kind === Kind.STRING) {
        return parseOrThrow(ast.value);
      }
      throw new TypeError(`Value is not a valid ${name}: ${ast.kind}`);
    },
  });
};

export const DmsStringResolver = graphQlParserResolver('DmsString', parseDmsString);
export const HmsStringResolver = graphQlParserResolver('HmsString', parseHmsString);
export const EpochStringResolver = graphQlParserResolver('EpochString', parseEpochString);
