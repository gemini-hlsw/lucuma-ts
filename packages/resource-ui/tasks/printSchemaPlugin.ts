import { type GraphQLSchema, printSchema } from 'graphql';

export const plugin = (schema: GraphQLSchema): string => printSchema(schema);
